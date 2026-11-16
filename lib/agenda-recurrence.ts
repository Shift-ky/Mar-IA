export const recurrences = ['once','daily','weekly','monthly'] as const;
export type Recurrence = typeof recurrences[number];
export const recurrenceLabels: Record<Recurrence,string> = {
 once:'Evento único',daily:'Diário',weekly:'Semanal',monthly:'Mensal'
};
const dayMs = 86400000;
const fortalezaOffset = 3 * 3600000;

export function occurrenceAt(base:number,repeat:Recurrence,index:number) {
 if (repeat!=='monthly') return base + index * (repeat==='weekly'?7:1) * dayMs;
 const local = new Date(base-fortalezaOffset);
 const year = local.getUTCFullYear();
 const month = local.getUTCMonth()+index;
 const day = Math.min(local.getUTCDate(),new Date(Date.UTC(year,month+1,0)).getUTCDate());
 return Date.UTC(year,month,day,local.getUTCHours(),local.getUTCMinutes())+fortalezaOffset;
}

export function occurrenceIndex(base:number,repeat:Recurrence,target:number) {
 if (base>=target || repeat==='once') return 0;
 if (repeat!=='monthly') return Math.ceil((target-base)/((repeat==='weekly'?7:1)*dayMs));
 const start = new Date(base-fortalezaOffset), end = new Date(target-fortalezaOffset);
 const month = (end.getUTCFullYear()-start.getUTCFullYear())*12+end.getUTCMonth()-start.getUTCMonth();
 return occurrenceAt(base,repeat,month)<target ? month+1 : month;
}

export function agendaDay(starts:number) {
 return new Date(starts-fortalezaOffset).toISOString().slice(0,10);
}
