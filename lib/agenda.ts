import {agendaDay,occurrenceAt,occurrenceIndex,recurrences,type Recurrence} from './agenda-recurrence';

const initialized = new WeakSet<D1Database>();

export async function ensureAgenda(db: D1Database) {
 if (initialized.has(db)) return;
 await db.batch([
  db.prepare(`CREATE TABLE IF NOT EXISTS agenda_events (
   id TEXT PRIMARY KEY, family TEXT NOT NULL, user TEXT NOT NULL, title TEXT NOT NULL,
   day TEXT NOT NULL, time TEXT NOT NULL, starts INTEGER NOT NULL, reminder INTEGER,
   amount INTEGER, unit TEXT
  )`),
  db.prepare(`CREATE TABLE IF NOT EXISTS agenda_recurrence (
   event_id TEXT PRIMARY KEY, repeat TEXT NOT NULL, next_starts INTEGER, next_reminder INTEGER,
   FOREIGN KEY(event_id) REFERENCES agenda_events(id) ON DELETE CASCADE
  )`),
  db.prepare(`CREATE TABLE IF NOT EXISTS agenda_periods (
   event_id TEXT PRIMARY KEY, end_day TEXT NOT NULL, end_time TEXT NOT NULL, ends INTEGER NOT NULL,
   FOREIGN KEY(event_id) REFERENCES agenda_events(id) ON DELETE CASCADE
  )`),
  db.prepare(`CREATE TABLE IF NOT EXISTS agenda_notifications (
   event_id TEXT PRIMARY KEY, audience TEXT NOT NULL, group_chat TEXT NOT NULL,
   FOREIGN KEY(event_id) REFERENCES agenda_events(id) ON DELETE CASCADE
  )`),
  db.prepare(`CREATE VIEW IF NOT EXISTS agenda_targets AS
   WITH allowed AS (
    SELECT a.id,a.user,a.family,p.email,n.audience,n.group_chat
    FROM agenda_events a
    JOIN families f ON f.id=a.family
    JOIN profiles p ON p.id=a.user AND p.phone IS NOT NULL
    JOIN members m ON m.family=a.family AND m.email=p.email
    LEFT JOIN agenda_notifications n ON n.event_id=a.id
    WHERE a.reminder IS NOT NULL AND (m.role='admin' OR json_extract(m.permissions,'$.sections.agenda') IS NOT 0)
   )
   SELECT a.id AS event_id,a.user,a.family,min(l.sender) AS chat,'' AS suffix
   FROM allowed a JOIN ev_links l ON l.user=a.user AND l.family=a.family AND lower(l.email)=a.email
   WHERE COALESCE(a.audience,'personal') IN ('personal','both') AND l.sender GLOB '[0-9]*@s.whatsapp.net'
   GROUP BY a.id,a.user,a.family
   UNION ALL
   SELECT a.id,a.user,a.family,g.chat,':family:'||g.chat
   FROM allowed a JOIN ev_groups g ON g.family=a.family AND g.chat=a.group_chat
   WHERE a.audience IN ('family','both') AND g.chat GLOB '[0-9]*@g.us'
  `),
  db.prepare('CREATE INDEX IF NOT EXISTS agenda_recurrence_due ON agenda_recurrence(next_reminder)'),
  db.prepare('CREATE INDEX IF NOT EXISTS agenda_events_owner ON agenda_events(family,user,starts)'),
  db.prepare('CREATE INDEX IF NOT EXISTS agenda_events_reminder ON agenda_events(reminder) WHERE reminder IS NOT NULL'),
  db.prepare(`CREATE TRIGGER IF NOT EXISTS delete_family_agenda AFTER DELETE ON families
   BEGIN DELETE FROM agenda_events WHERE family=OLD.id; END`)
 ]);
 initialized.add(db);
}

function parseAgendaTime(day:unknown,time:unknown) {
 if (typeof day!=='string'||typeof time!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return NaN;
 const timestamp = Date.parse(day+'T'+time+':00-03:00');
 return Number.isFinite(timestamp)&&agendaDay(timestamp)===day ? timestamp : NaN;
}

export function agendaEvent(input: any, now = Date.now(), previousReminder:number|null = null) {
 const title = typeof input.title === 'string' ? input.title.trim() : '';
 const {day,time} = input;
 const starts = parseAgendaTime(day,time);
 if (!title || title.length > 120) throw Error('Informe um título de até 120 caracteres.');
 if (!Number.isFinite(starts)) throw Error('Informe uma data e um horário de início válidos.');
 const endDay = input.endDay || null;
 const endTime = input.endTime || null;
 const ends = endDay||endTime ? parseAgendaTime(endDay,endTime) : null;
 if (ends!==null&&(!Number.isFinite(ends)||ends<=starts)) {
  throw Error('Informe uma data e um horário de fim posteriores ao início.');
 }
 const period = {endDay,endTime,ends};
 const repeat:Recurrence = input.repeat ?? 'once';
 if (!recurrences.includes(repeat)) throw Error('Selecione uma frequência válida.');
 const unit = input.unit ?? 'none';
 if (unit === 'none') return {title,day,time,starts,repeat,...period,reminder:null,amount:null,unit:null};
 const amount = Number(input.amount);
 const limit = unit === 'days' ? 365 : unit === 'hours' ? 8760 : 0;
 if (!Number.isInteger(amount) || amount < 1 || amount > limit) throw Error('Informe uma antecedência válida.');
 const reminder = starts - amount * (unit === 'days' ? 86400000 : 3600000);
 if (repeat==='once' && reminder <= now && reminder!==previousReminder) throw Error('O horário do lembrete já passou. Ajuste a antecedência ou o compromisso.');
 return {title,day,time,starts,repeat,...period,reminder,amount,unit};
}

export async function queueAgendaReminders(db: D1Database, now = Date.now()) {
 await ensureAgenda(db);
 await db.batch([
  db.prepare(`UPDATE ev_outbox SET state='blocked' WHERE state='queued' AND id IN
   (SELECT 'agenda:'||id FROM agenda_events WHERE starts<=? AND reminder IS NOT NULL)
   OR state='queued' AND id LIKE 'agenda:%' AND json_extract(context,'$.agendaStarts')<=?`).bind(now,now),
  db.prepare(`
  INSERT OR IGNORE INTO ev_outbox(id,chat,body,context,state)
  SELECT 'agenda:'||a.id||t.suffix,t.chat,
   'Lembrete da Agenda Mar IA' || char(10) || a.title || char(10) ||
    substr(a.day,9,2) || '/' || substr(a.day,6,2) || '/' || substr(a.day,1,4) ||
    ' às ' || a.time || ' (Fortaleza)',
   json_object('user',a.user,'family',a.family,'chat',t.chat,'agendaStarts',a.starts),'queued'
  FROM agenda_events a JOIN agenda_targets t ON t.event_id=a.id
  WHERE a.reminder<=? AND a.starts>? AND NOT EXISTS (SELECT 1 FROM agenda_recurrence r WHERE r.event_id=a.id)
   AND NOT EXISTS (SELECT 1 FROM ev_outbox o WHERE o.id='agenda:'||a.id||t.suffix)
  ORDER BY a.reminder,a.id LIMIT 25
 `).bind(now,now)
 ]);
}

type DueSeries = {
 id:string; time:string; starts:number; reminder:number;
 repeat:Recurrence; next_starts:number;
};

export async function queueRepeatingAgendaReminders(db:D1Database,now=Date.now()) {
 const due = await db.prepare(`
  SELECT a.id,a.time,a.starts,a.reminder,r.repeat,r.next_starts
  FROM agenda_recurrence r JOIN agenda_events a ON a.id=r.event_id
  WHERE r.next_reminder<=? AND EXISTS (SELECT 1 FROM agenda_targets t WHERE t.event_id=a.id)
  ORDER BY r.next_reminder,a.id LIMIT 25
 `).bind(now).all<DueSeries>();
 for (const event of due.results) {
  const lead = event.starts-event.reminder;
  const index = occurrenceIndex(event.starts,event.repeat,Math.max(now+1,event.next_starts));
  const starts = occurrenceAt(event.starts,event.repeat,index);
  const reminder = starts-lead;
  if (reminder>now) {
   await db.prepare('UPDATE agenda_recurrence SET next_starts=?,next_reminder=? WHERE event_id=? AND next_starts=?')
    .bind(starts,reminder,event.id,event.next_starts).run();
   continue;
  }
  const next = occurrenceAt(event.starts,event.repeat,index+1);
  const messageId = 'agenda:'+event.id+':'+starts;
  const scheduledTime = agendaDay(starts).split('-').reverse().join('/')+' às '+event.time+' (Fortaleza)';
  await db.batch([
   db.prepare(`INSERT OR IGNORE INTO ev_outbox(id,chat,body,context,state)
    SELECT ?||t.suffix,t.chat,'Lembrete da Agenda Mar IA'||char(10)||a.title||char(10)||?,
     json_object('user',a.user,'family',a.family,'chat',t.chat,'agendaStarts',?),'queued'
    FROM agenda_targets t JOIN agenda_events a ON a.id=t.event_id
    JOIN agenda_recurrence r ON r.event_id=a.id
    WHERE a.id=? AND r.next_starts=? AND a.starts=? AND a.reminder=? AND r.repeat=?`)
    .bind(messageId,scheduledTime,starts,event.id,event.next_starts,event.starts,event.reminder,event.repeat),
   db.prepare(`UPDATE agenda_recurrence SET next_starts=?,next_reminder=? WHERE event_id=? AND next_starts=?
     AND EXISTS (SELECT 1 FROM agenda_targets t JOIN ev_outbox o ON o.id=?||t.suffix WHERE t.event_id=?)`)
    .bind(next,next-lead,event.id,event.next_starts,messageId,event.id)
  ]);
 }
}
