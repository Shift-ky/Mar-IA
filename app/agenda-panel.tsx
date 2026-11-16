'use client';
import {useEffect,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,X} from 'lucide-react';
import {entryDate} from '../lib/entry-date';
import {nationalHolidays} from '../lib/national-holidays';
import {reminderAudiences,reminderAudienceLabels,type ReminderAudience} from '../lib/agenda-notifications';
import {agendaDay,occurrenceAt,occurrenceIndex,recurrences,recurrenceLabels,type Recurrence} from '../lib/agenda-recurrence';

type Event = {
 id:string; title:string; day:string; time:string; starts:number; reminder:number|null;
 amount:number|null; unit:'hours'|'days'|null; state:string|null; author:string; repeat:Recurrence|null; endDay:string|null; endTime:string|null; ends:number|null; audience:ReminderAudience; groupChat:string|null; groupState:string|null;
};
type Agenda = {events:Event[]; linked:boolean; bridgeActive:boolean; groups:string[]};
const statuses: Record<string,string> = {
 sent:'Enviado pelo WhatsApp', sending:'Enviando pelo WhatsApp',
 queued:'Na fila do WhatsApp', needs_review:'Entrega do WhatsApp a confirmar',
 blocked:'Envio indisponível'
};

const weekdays = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const monthLabel = new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'});
const dayLabel = new Intl.DateTimeFormat('pt-BR',{dateStyle:'full',timeZone:'UTC'});
const utcDate = (day:string) => new Date(day+'T00:00:00Z');
const isoDay = (date:Date) => date.toISOString().slice(0,10);

function calendarDays(first:Date) {
 const count = new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
 const leading = first.getUTCDay();
 const cells = Math.ceil((leading+count)/7)*7;
 return Array.from({length:cells},(_,index) => {
  const date = index-leading+1;
  return date>=1 && date<=count ? isoDay(new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),date))) : null;
 });
}

export default function AgendaPanel({family,onIntegrations}:{family:string;onIntegrations?:()=>void}) {
 const [day,setDay] = useState(() => entryDate());
 const [today,setToday] = useState(() => entryDate());
 const [agenda,setAgenda] = useState<Agenda|null>(null);
 const [unit,setUnit] = useState('none');
 const [audience,setAudience] = useState<ReminderAudience>('personal');
 const [groupChat,setGroupChat] = useState('');
 const [error,setError] = useState('');
 const [busy,setBusy] = useState(false);
 const [pendingRemoval,setPendingRemoval] = useState('');
 const [key,setKey] = useState('');
 const [editing,setEditing] = useState<Event|null>(null);
 const [hasEnd,setHasEnd] = useState(false);
 const formElement = useRef<HTMLFormElement>(null);
 const dayPanel = useRef<HTMLElement>(null);
 const url = '/api/agenda?family='+encodeURIComponent(family);
 async function request(signal?:AbortSignal, body?:object) {
  const response = await fetch(url,{signal,cache:'no-store',...(body&&{
   method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
  })});
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw Error(data?.error||'Não foi possível acessar a Agenda.');
  return data;
 }
 useEffect(() => {
  const controller = new AbortController();
  const refresh = async () => {
   setToday(entryDate());
   try { setAgenda(await request(controller.signal)); }
   catch (error) { if (!controller.signal.aborted) setError((error as Error).message); }
  };
  void refresh();
  const timer = window.setInterval(refresh,30000);
  return () => { controller.abort(); window.clearInterval(timer); };
 },[url]);

 async function save(e:React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  const form = e.currentTarget;
  const fields = Object.fromEntries(new FormData(form));
  const id = editing?.id || key || crypto.randomUUID();
  setKey(id);
  setBusy(true); setError('');
  try {
   await request(undefined,{action:editing?'edit':'save',id,...fields});
   form.reset();
   resetForm();
   setDay(String(fields.day));
   setAgenda(await request());
  } catch (error) { setError((error as Error).message); }
  finally { setBusy(false); }
 }
 async function remove(id:string) {
  setBusy(true); setError('');
  try {
   await request(undefined,{action:'remove',id});
   setPendingRemoval('');
   if (editing?.id===id) resetForm();
   setAgenda(await request());
  } catch (error) { setError((error as Error).message); }
  finally { setBusy(false); }
 }
 function resetForm() {
  setEditing(null); setUnit('none'); setAudience('personal'); setGroupChat(''); setHasEnd(false); setKey('');
 }

 function editEvent(id:string) {
  const original = agenda?.events.find(event=>event.id===id);
  if (!original) return;
  setPendingRemoval(''); setEditing(original); setUnit(original.unit??'none'); setAudience(original.audience??'personal'); setGroupChat(original.groupChat??''); setHasEnd(original.ends!==null); setKey('');
  requestAnimationFrame(()=>formElement.current?.querySelector('textarea')?.focus());
 }

 const periodLabel = (event:Event) => {
  if (event.ends===null) return event.time;
  const startDay = agendaDay(event.starts);
  if (startDay===event.endDay) return event.time+' às '+event.endTime;
  return startDay.split('-').reverse().join('/')+' às '+event.time+' até '+event.endDay?.split('-').reverse().join('/')+' às '+event.endTime;
 };

 function eventRow(event:Event) {
  const delay = event.unit==='days' ? (event.amount===1?'dia':'dias') : (event.amount===1?'hora':'horas');
  const destination = event.audience??'personal';
  const status = (state:string|null) => state ? statuses[state] : event.starts<=Date.now() ? 'Horário do compromisso passou' : 'Lembrete agendado';
  return <article className="queueitem agenda-event" key={event.id}>
   <strong>{event.title}</strong>
   <small>{periodLabel(event)}{event.repeat&&' · '+recurrenceLabels[event.repeat]}</small>
   {event.author&&<small>Adicionado por {event.author}</small>}
   {event.reminder!==null&&<>
    <small>WhatsApp · {reminderAudienceLabels[destination]} · {event.amount} {delay} antes</small>
    {!event.repeat&&destination!=='family'&&<small>Pessoal · {status(event.state)}</small>}
    {!event.repeat&&destination!=='personal'&&<small>Grupo da família · {status(event.groupState)}</small>}
   </>}
   {pendingRemoval===event.id?<div className="actions">
    <button type="button" disabled={busy} onClick={()=>void remove(event.id)}>{event.repeat?'Excluir toda a série':'Confirmar exclusão'}</button>
    <button type="button" disabled={busy} onClick={()=>setPendingRemoval('')}>Cancelar</button>
   </div>:<div className="actions">
    <button type="button" disabled={busy} onClick={()=>editEvent(event.id)}>{event.repeat?'Editar série':'Editar'}</button>
    <button type="button" disabled={busy} onClick={()=>setPendingRemoval(event.id)}>Excluir</button>
   </div>}
  </article>;
 }
 const first = utcDate(day.slice(0,7)+'-01');
 const eventsByDay = new Map<string,Event[]>();
 const cells = calendarDays(first);
 const holidays = nationalHolidays(first.getUTCFullYear());
 for (const date of cells) {
  if (!date) continue;
  const startOfDay = Date.parse(date+'T00:00:00-03:00');
  const nextDay = startOfDay+86400000;
  const events:Event[] = [];
  for (const event of agenda?.events ?? []) {
   if (event.starts>=nextDay) continue;
   const repeat = event.repeat ?? 'once';
   const index = repeat==='once' ? 0 : occurrenceIndex(event.starts,repeat,nextDay)-1;
   const starts = occurrenceAt(event.starts,repeat,index);
   const ends = event.ends===null ? null : starts+(event.ends-event.starts);
   if ((ends??starts)<startOfDay) continue;
   events.push({...event,starts,ends,endDay:ends===null?null:agendaDay(ends)});
  }
  eventsByDay.set(date,events.sort((a,b)=>a.starts-b.starts));
 }
 const daily = eventsByDay.get(day) ?? [];
 const groups = agenda?.groups ?? [];
 const selectedGroup = groupChat || (groups.length===1 ? groups[0] : '');
 const needsGroup = audience!=='personal';

 function selectDay(date:string) {
  if (date===day) return;
  setDay(date); setPendingRemoval(''); resetForm();
 }
 function moveMonth(offset:number) {
  selectDay(isoDay(new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+offset,1))));
 }
 function openDay(date:string) {
  selectDay(date);
  if (window.matchMedia('(max-width: 1050px)').matches) dayPanel.current?.scrollIntoView({block:'start'});
 }

 return <div className="agenda-layout">
  <section className="panel agenda-calendar" aria-label="Calendário mensal">
   <div className="agenda-calendar-bar">
    <h2 aria-live="polite">{monthLabel.format(first)}</h2>
    <div className="actions">
     <button type="button" disabled={busy} onClick={()=>selectDay(today)}>Hoje</button>
     <button type="button" aria-label="Mês anterior" disabled={busy} onClick={()=>moveMonth(-1)}><ChevronLeft size={18}/></button>
     <button type="button" aria-label="Próximo mês" disabled={busy} onClick={()=>moveMonth(1)}><ChevronRight size={18}/></button>
    </div>
   </div>
   <div className="agenda-grid">
    {weekdays.map(label=><span className="agenda-weekday" key={label}>{label}</span>)}
    {cells.map((date,index)=>{
     if (!date) return <span className="agenda-blank" aria-hidden="true" key={'blank-'+index}/>;
     const events = eventsByDay.get(date) ?? [];
     const holiday = holidays.get(date);
     const past = date<today;
     return <button type="button" className="agenda-date" key={date} disabled={busy}
      aria-pressed={date===day} aria-current={date===today?'date':undefined}
      data-past={past||undefined} data-holiday={!!holiday||undefined}
      aria-label={dayLabel.format(utcDate(date))+(past?' · Dia passado':'')+(holiday?' · Feriado nacional: '+holiday:'')+(events.length?' · '+events.length+' compromisso(s)':'')}
      onClick={()=>openDay(date)}>
      <span className="agenda-date-number">{Number(date.slice(-2))}</span>
      {past&&<X className="agenda-past-mark" aria-hidden="true" size={14} strokeWidth={3}/>}
      {holiday&&<span className="agenda-holiday" title={holiday}><span>{holiday}</span></span>}
      {events.length>0&&<span className="agenda-date-count" aria-hidden="true">{events.length}</span>}
      {events.length>0&&<span className="agenda-preview">{events.slice(0,2).map(event=>
       <span key={event.id}>{event.time} {event.title}{event.author&&<small>{event.author}</small>}</span>
      )}</span>}
     </button>;
    })}
   </div>
  </section>
  <section className="panel agenda-day-panel" ref={dayPanel} aria-labelledby="agenda-day-title">
   <div className="sectiontitle"><div><h2 id="agenda-day-title" aria-live="polite">{dayLabel.format(utcDate(day))}</h2><p>Horário de Fortaleza</p></div></div>
   {holidays.has(day)&&<p className="agenda-holiday-detail"><strong>Feriado nacional</strong> · {holidays.get(day)}</p>}
   {error&&<p className="alert" role="alert">{error}</p>}
   {agenda ? daily.length ? daily.map(event=>eventRow(event)) : <p>Nenhum compromisso para este dia.</p>
    : error ? <button type="button" onClick={()=>void request().then(data=>{setAgenda(data);setError('')}).catch(e=>setError(e.message))}>Tentar novamente</button> : <p>Carregando compromissos…</p>}
   <form key={editing?.id??day} ref={formElement} onSubmit={save} className="agenda-day-form">
    <h3>{editing?(editing.repeat?'Editar série':'Editar compromisso'):'Novo compromisso'}</h3>
    <label>Compromisso<textarea name="title" placeholder="Ex.: Consulta" rows={2} maxLength={120} defaultValue={editing?.title} required/></label>
    <div className="formgrid agenda-period-fields">
     <label>Data de início<input name="day" type="date" defaultValue={editing?.day??day} required/></label>
     <label>Horário de início<input name="time" type="time" defaultValue={editing?.time} required/></label>
    </div>
    <label className="agenda-period-toggle"><input type="checkbox" checked={hasEnd} onChange={e=>setHasEnd(e.target.checked)}/> Definir fim</label>
    {hasEnd&&<div className="formgrid agenda-period-fields">
     <label>Data de fim<input name="endDay" type="date" defaultValue={editing?.endDay??(formElement.current?.elements.namedItem('day') as HTMLInputElement|null)?.value??day} required/></label>
     <label>Horário de fim<input name="endTime" type="time" defaultValue={editing?.endTime??undefined} required/></label>
    </div>}
    <label>Repetição<select name="repeat" defaultValue={editing?.repeat??'once'}>
     {recurrences.map(repeat=><option key={repeat} value={repeat}>{recurrenceLabels[repeat]}</option>)}
    </select></label>
    <div className="formgrid">
     <label>Lembrete pelo WhatsApp<select name="unit" value={unit} onChange={e=>setUnit(e.target.value)}>
      <option value="none">Sem lembrete</option><option value="hours">Horas antes</option><option value="days">Dias antes</option>
     </select></label>
     {unit!=='none'&&<label>Antecedência em {unit==='days'?'dias':'horas'}<input name="amount" type="number" min="1" max={unit==='days'?365:8760} defaultValue={editing?.amount??1} required/></label>}
     {unit!=='none'&&<>
      <label>Destino da notificação<select name="audience" value={audience} onChange={e=>setAudience(e.target.value as ReminderAudience)}>
       {reminderAudiences.map(option=><option key={option} value={option}>{reminderAudienceLabels[option]}</option>)}
      </select></label>
      {needsGroup&&<>
       <label>Grupo do WhatsApp<select name="groupChat" required value={selectedGroup} onChange={e=>setGroupChat(e.target.value)}>
        <option value="">Selecione um grupo vinculado</option>
        {groups.map((group,index)=><option key={group} value={group}>Grupo {index+1} · final {group.split('@')[0].slice(-4)}</option>)}
        {groupChat&&!groups.includes(groupChat)&&<option value={groupChat}>Grupo desvinculado</option>}
       </select></label>
       <small>O título e o horário do compromisso serão enviados ao grupo selecionado.</small>
      </>}
      {agenda&&((needsGroup&&!groups.includes(selectedGroup)&&!groups.length)||(audience!=='family'&&!agenda.linked))&&
       <p>{needsGroup&&!groups.length?'Vincule um grupo do WhatsApp em Meu cadastro → Integrações.':'Vincule seu número em Meu cadastro → Integrações para receber o lembrete pessoal.'}{' '}
        {onIntegrations&&<button type="button" className="textbutton" onClick={onIntegrations}>Abrir Meu cadastro</button>}
       </p>}
      {agenda&&!agenda.bridgeActive&&<small>A ponte do WhatsApp está offline. O envio depende de ela voltar antes do compromisso.</small>}
     </>}
    </div>
    <div className="actions">
     <button className="primary" disabled={busy}>{editing?'Salvar alterações':'Salvar compromisso'}</button>
     {editing&&<button type="button" disabled={busy} onClick={resetForm}>Cancelar edição</button>}
    </div>
   </form>
  </section>
 </div>;
}
