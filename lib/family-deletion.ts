// The caller supplies the same transactional revision guard used by all writes.
export function familyDeletion(family:string,add:(sql:string,args:any[])=>void,guard:string,keepRevision=false){
 const phones='SELECT phone FROM wa_links WHERE family=?';
 add(`DELETE FROM wa_inbox WHERE phone IN (${phones}) AND ${guard}`,[family]);
 add(`DELETE FROM wa_outbox WHERE (phone IN (${phones}) OR json_extract(CASE WHEN json_valid(body) THEN body ELSE '{}' END,'$.family')=?) AND ${guard}`,[family,family]);
 for(const prefix of ['tg-flow:','tg-shopping-view:','tg-receipt-active:','tg-activation:'])add(`DELETE FROM settings WHERE key IN (SELECT ?||phone FROM wa_links WHERE family=?) AND ${guard}`,[prefix,family]);
 add(`DELETE FROM settings WHERE (key=? OR (key LIKE 'home-family:%' AND value=?) OR (key LIKE 'tg-%' AND json_extract(CASE WHEN json_valid(value) THEN value ELSE '{}' END,'$.family')=?)) AND ${guard}`,['tg-family-code:'+family,family,family]);
 // Files keep a retry marker until bucket deletion succeeds.
 add(`UPDATE wa_documents SET state='deleted',data='{}' WHERE family=? AND ${guard}`,[family]);
 for(const table of ['wa_links','wa_pairings','wa_drafts','join_requests','records','members','families'])add(`DELETE FROM ${table} WHERE ${table==='families'?'id':'family'}=? AND ${guard}`,[family]);
 if(!keepRevision)add(`DELETE FROM settings WHERE key=? AND ${guard}`,['rev:'+family]);
}
