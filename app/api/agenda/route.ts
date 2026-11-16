import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {actor} from '../../../lib/whatsapp/access';
import {boundedBody} from '../../../lib/whatsapp/crypto';
import {occurrenceAt,occurrenceIndex} from '../../../lib/agenda-recurrence';
import {reminderAudiences,type ReminderAudience} from '../../../lib/agenda-notifications';
import {agendaEvent,ensureAgenda} from '../../../lib/agenda';

export const dynamic = 'force-dynamic';
const json = (data: unknown,status = 200) => Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

async function access(req: Request) {
 const user = await getChatGPTUser(req);
 const db = env.DB;
 if (!user || !db) throw Error('Acesso indisponível.');
 const account = await actor(db,user.userId,user.email,new URL(req.url).searchParams.get('family') || '');
 if (!account.admin && account.permissions.sections?.agenda === false) throw Error('Acesso restrito.');
 return {db,...account};
}

export async function GET(req: Request) {
 let owner;
 try { owner = await access(req); } catch { return json({error:'Acesso à Agenda não autorizado.'},403); }
 const {db,family,user} = owner;
 await ensureAgenda(db);
 const [events,link,bridge,groups] = await db.batch([
  db.prepare(`SELECT a.id,a.title,a.day,a.time,a.starts,a.reminder,a.amount,a.unit,o.state,p.name AS author,r.repeat,d.end_day AS endDay,d.end_time AS endTime,d.ends,
   COALESCE(n.audience,'personal') AS audience,n.group_chat AS groupChat,g.state AS groupState
   FROM agenda_events a JOIN profiles p ON p.id=a.user
   LEFT JOIN agenda_recurrence r ON r.event_id=a.id LEFT JOIN agenda_periods d ON d.event_id=a.id
   LEFT JOIN agenda_notifications n ON n.event_id=a.id
   LEFT JOIN ev_outbox o ON o.id='agenda:'||a.id
   LEFT JOIN ev_outbox g ON g.id='agenda:'||a.id||':family:'||n.group_chat
   WHERE a.family=? AND a.user=? ORDER BY a.starts,a.id`).bind(family,user),
  db.prepare('SELECT 1 FROM ev_links WHERE family=? AND user=? LIMIT 1').bind(family,user),
  db.prepare("SELECT value FROM settings WHERE key='ev:last-seen'"),
  db.prepare("SELECT chat FROM ev_groups WHERE family=? AND chat GLOB '[0-9]*@g.us' ORDER BY chat").bind(family)
 ]);
 return json({events:events.results,linked:link.results.length>0,groups:groups.results.map(row=>row.chat),
  bridgeActive:Date.now() - Date.parse(String((bridge.results[0] as any)?.value)) < 60000});
}

export async function POST(req: Request) {
 const origin = req.headers.get('origin');
 if (origin && origin !== new URL(req.url).origin) return json({error:'Origem inválida.'},403);
 let owner;
 try { owner = await access(req); } catch { return json({error:'Acesso à Agenda não autorizado.'},403); }
 const {db,family,user} = owner;
 let input;
 try { input = JSON.parse(await boundedBody(req,4096)); }
 catch { return json({error:'Dados inválidos.'},400); }
 await ensureAgenda(db);

 if (input?.action === 'remove') {
  if (typeof input.id !== 'string') return json({error:'Compromisso inválido.'},400);
  await db.batch([
   db.prepare(`DELETE FROM ev_outbox WHERE (id='agenda:'||? OR id LIKE 'agenda:'||?||':%') AND state='queued' AND EXISTS
    (SELECT 1 FROM agenda_events WHERE id=? AND family=? AND user=?)`).bind(input.id,input.id,input.id,family,user),
   db.prepare('DELETE FROM agenda_events WHERE id=? AND family=? AND user=?').bind(input.id,family,user)
  ]);
  return json({ok:true});
 }
 const editing = input?.action==='edit';
 if ((!editing && input?.action!=='save') || typeof input.id!=='string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(input.id)) {
  return json({error:'Compromisso inválido.'},400);
 }
 const scope = [input.id,family,user];
 const owned = 'SELECT 1 FROM agenda_events WHERE id=? AND family=? AND user=?';
 const prior = await db.prepare(`SELECT a.title,a.starts,a.reminder,r.repeat,n.audience,n.group_chat FROM agenda_events a
  LEFT JOIN agenda_recurrence r ON r.event_id=a.id LEFT JOIN agenda_notifications n ON n.event_id=a.id
  WHERE a.id=? AND a.family=? AND a.user=?`)
  .bind(...scope).first<{title:string;starts:number;reminder:number|null;repeat:string|null;audience:ReminderAudience|null;group_chat:string|null}>();
 if (prior && !editing) return json({ok:true});
 if (!prior && editing) return json({error:'Compromisso indisponível.'},404);
 const now = Date.now();
 let event;
 try { event = agendaEvent(input,now,prior?.reminder); }
 catch (error) { return json({error:(error as Error).message},400); }

 const audience:ReminderAudience = event.reminder===null ? 'personal' : input.audience ?? prior?.audience ?? 'personal';
 if (!reminderAudiences.includes(audience)) return json({error:'Escolha um destino válido para o lembrete.'},400);
 const group:unknown = audience==='personal' ? null : input.groupChat ?? prior?.group_chat;
 if (audience!=='personal' && (typeof group!=='string'||!/^\d+(?:-\d+)?@g\.us$/.test(group))) {
  return json({error:'Selecione um grupo de WhatsApp vinculado à família.'},400);
 }
 if (typeof group==='string' && group!==prior?.group_chat) {
  const linkedGroup = await db.prepare('SELECT 1 FROM ev_groups WHERE family=? AND chat=?').bind(family,group).first();
  if (!linkedGroup) return json({error:'O grupo escolhido precisa estar vinculado a esta família.'},400);
 }

 const fields = [event.title,event.day,event.time,event.starts,event.reminder,event.amount,event.unit];
 const changes = [editing
  ? db.prepare('UPDATE agenda_events SET title=?,day=?,time=?,starts=?,reminder=?,amount=?,unit=? WHERE id=? AND family=? AND user=?')
   .bind(...fields,...scope)
  : db.prepare(`INSERT OR IGNORE INTO agenda_events
    (title,day,time,starts,reminder,amount,unit,id,family,user) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(...fields,...scope)];

 if (event.ends!==null) {
  changes.push(db.prepare(`INSERT INTO agenda_periods(event_id,end_day,end_time,ends)
   SELECT id,?,?,? FROM agenda_events WHERE id=? AND family=? AND user=?
   ON CONFLICT(event_id) DO UPDATE SET end_day=excluded.end_day,end_time=excluded.end_time,ends=excluded.ends`)
   .bind(event.endDay,event.endTime,event.ends,...scope));
 } else if (editing) {
  changes.push(db.prepare(`DELETE FROM agenda_periods WHERE event_id=? AND EXISTS (${owned})`).bind(input.id,...scope));
 }

 if (typeof group==='string') {
  changes.push(db.prepare(`INSERT INTO agenda_notifications(event_id,audience,group_chat)
   SELECT id,?,? FROM agenda_events WHERE id=? AND family=? AND user=?
   ON CONFLICT(event_id) DO UPDATE SET audience=excluded.audience,group_chat=excluded.group_chat`)
   .bind(audience,group,...scope));
 } else if (editing) {
  changes.push(db.prepare(`DELETE FROM agenda_notifications WHERE event_id=? AND EXISTS (${owned})`).bind(input.id,...scope));
 }

 const scheduleChanged = !prior || prior.starts!==event.starts || prior.reminder!==event.reminder || (prior.repeat??'once')!==event.repeat ||
  (prior.audience??'personal')!==audience || (prior.group_chat??null)!==group;
 if (scheduleChanged && event.repeat!=='once') {
  const lead = event.reminder===null ? null : event.starts-event.reminder;
  const target = editing ? now+1 : now+(lead??0)+1;
  const next = lead===null ? null : occurrenceAt(event.starts,event.repeat,occurrenceIndex(event.starts,event.repeat,target));
  changes.push(db.prepare(`INSERT INTO agenda_recurrence(event_id,repeat,next_starts,next_reminder)
   SELECT id,?,?,? FROM agenda_events WHERE id=? AND family=? AND user=?
   ON CONFLICT(event_id) DO UPDATE SET repeat=excluded.repeat,next_starts=excluded.next_starts,next_reminder=excluded.next_reminder`)
   .bind(event.repeat,next,next===null||lead===null?null:next-lead,...scope));
 } else if (scheduleChanged && editing) {
  changes.push(db.prepare(`DELETE FROM agenda_recurrence WHERE event_id=? AND EXISTS (${owned})`).bind(input.id,...scope));
 }
 if (prior && scheduleChanged) {
  changes.push(db.prepare(`DELETE FROM ev_outbox WHERE (id='agenda:'||? OR id LIKE 'agenda:'||?||':%')
   AND state='queued' AND EXISTS (${owned})`).bind(input.id,input.id,...scope));
  if (prior.starts!==event.starts && event.repeat==='once') {
   changes.push(db.prepare(`DELETE FROM ev_outbox WHERE (id='agenda:'||? OR id LIKE 'agenda:'||?||':family:%') AND state IN ('sent','blocked','needs_review')
    AND EXISTS (${owned})`).bind(input.id,input.id,...scope));
  }
 } else if (prior && prior.title!==event.title) {
  const prefix = 'Lembrete da Agenda Mar IA\n';
  changes.push(db.prepare(`UPDATE ev_outbox SET body=?||substr(body,?)
   WHERE (id='agenda:'||? OR id LIKE 'agenda:'||?||':%') AND state='queued' AND EXISTS (${owned})`)
   .bind(prefix+event.title+'\n',-'00/00/0000 às 00:00 (Fortaleza)'.length,input.id,input.id,...scope));
 }
 const result = await db.batch(changes);
 if (editing && !result[0]?.meta.changes) return json({error:'Compromisso indisponível.'},404);
 return json({ok:true});
}
