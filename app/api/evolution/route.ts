import {getChatGPTUser} from '../../chatgpt-auth';
import {env} from 'cloudflare:workers';
import {actor} from '../../../lib/whatsapp/access';
import {boundedBody,digest} from '../../../lib/whatsapp/crypto';
import {ready} from '../../../lib/evolution/service';
import {purgeDocuments} from '../../../lib/evolution/documents';
import {purgeDeletedDocuments} from '../../../lib/receipt-deletion';
import {financialReceipt} from '../../../lib/telegram/financial-receipt';
export const dynamic='force-dynamic';
const json=(v:any,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
async function access(family:string,request:Request){const u=await getChatGPTUser(request);if(!u||!env.DB)throw Error();return actor(env.DB,u.userId,u.email,family);}
export async function GET(req:Request){try{
 const url=new URL(req.url),a=await access(url.searchParams.get('family')||'',req),db=env.DB!;
 const document=url.searchParams.get('document');if(document){const doc=await db.prepare("SELECT * FROM ev_documents WHERE id=? AND family=? AND state<>'deleted'").bind(document,a.family).first<any>();if(!doc||!a.permissions.view&&doc.user!==a.user)return json({error:'Sem acesso ao documento.'},403);const file=await env.BUCKET?.get(doc.storage);if(!file)return json({error:'Arquivo não encontrado.'},404);return new Response(file.body,{headers:{'Content-Type':doc.mime,'Content-Disposition':'attachment; filename="comprovante.'+(doc.mime==='application/pdf'?'pdf':doc.mime==='image/png'?'png':'jpg')+'"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
 const documents=await db.prepare("SELECT id,user,mime,state,data,created FROM ev_documents WHERE family=? AND state<>'deleted' AND (?=1 OR user=?) ORDER BY created DESC LIMIT 100").bind(a.family,a.permissions.view?1:0,a.user).all();
 const links=await db.prepare('SELECT sender FROM ev_links WHERE user=? AND family=?').bind(a.user,a.family).all();
 const groups=a.admin?await db.prepare('SELECT chat FROM ev_groups WHERE family=?').bind(a.family).all():{results:[]};
 const last=a.admin?await db.prepare("SELECT value FROM settings WHERE key='ev:last-seen'").first<any>():null;
 const issues=a.admin?await db.prepare("SELECT id,state,error FROM ev_outbox WHERE json_extract(context,'$.family')=? AND state IN ('needs_review','blocked') LIMIT 20").bind(a.family).all():{results:[]};
 return json({configured:ready(env),links:links.results,groups:groups.results,lastSeen:last?.value||null,issues:issues.results,documents:documents.results});
 }catch{return json({error:'Acesso não autorizado ou integração ainda não publicada.'},403)}}
export async function POST(req:Request){try{
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Origem inválida.'},403);
 const b=JSON.parse(await boundedBody(req,4096)),a=await access(b.family,req),db=env.DB!;
 if(b.action==='deleteDocument'){
  if(!a.permissions.delete)return json({error:'Sem permissão para excluir documentos.'},403);
  const evDoc=await db.prepare("SELECT id,user,storage FROM ev_documents WHERE id=? AND family=? AND state<>'deleted'").bind(b.documentId,a.family).first<any>();
  const waDoc=evDoc?null:await db.prepare("SELECT id,user,storage FROM wa_documents WHERE id=? AND family=? AND state<>'deleted'").bind(b.documentId,a.family).first<any>();
  const doc=evDoc||waDoc;if(!doc||!a.permissions.view&&doc.user!==a.user)return json({error:'Documento indisponível ou já excluído. Atualize a lista.'},404);
  const table=evDoc?'ev_documents':'wa_documents',data=JSON.stringify({deletedAt:new Date().toISOString()}),results=await db.batch([
   db.prepare(`UPDATE ${table} SET state='deleted',data=? WHERE id=? AND family=? AND state<>'deleted' AND (?=1 OR user=?)`).bind(data,doc.id,a.family,a.permissions.view?1:0,a.user),
   db.prepare("DELETE FROM records WHERE family=? AND json_extract(data,'$.receiptId')=? AND kind IN ('transaction','purchaseItem','stockMovement')").bind(a.family,doc.id),
   db.prepare("DELETE FROM settings WHERE (key LIKE 'ev:receipt:%' OR key LIKE 'tg-receipt-active:%') AND (json_extract(value,'$.documentId')=? OR json_extract(value,'$.id')=?)").bind(doc.id,doc.id),
   db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind('rev:'+a.family,crypto.randomUUID())
  ]);
  if(!results[0].meta.changes)return json({error:'O documento mudou. Atualize a lista e tente novamente.'},409);
  if(waDoc)await purgeDeletedDocuments(env);else try{await purgeDocuments(env);}catch{}
  return json({ok:true});
 }
 if(b.action==='approveDocument'||b.action==='rejectDocument'){
 if(!a.permissions.add)return json({error:'Sem permissão para registrar documentos.'},403);
 const doc=await db.prepare("SELECT * FROM ev_documents WHERE id=? AND family=? AND state='needs_review'").bind(b.documentId,a.family).first<any>();if(!doc||!a.permissions.view&&doc.user!==a.user)return json({error:'Documento indisponível.'},403);
 if(b.action==='rejectDocument'){await db.prepare("UPDATE ev_documents SET state='deleted',data='{}' WHERE id=? AND state='needs_review'").bind(doc.id).run();return json({ok:true});}
 const receipt=financialReceipt(b.receipt,true),marker='ev-review:'+crypto.randomUUID();
 await db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,'0')").bind('rev:'+a.family).run();const rev=await db.prepare('SELECT value FROM settings WHERE key=?').bind('rev:'+a.family).first<any>();
 const permission="EXISTS (SELECT 1 FROM members WHERE family=? AND email=? AND (role='admin' OR json_extract(permissions,'$.add')=1)) AND EXISTS (SELECT 1 FROM profiles WHERE id=? AND email=?)";
 const g="EXISTS (SELECT 1 FROM settings WHERE key=? AND value=?)",args=['rev:'+a.family,marker];
 const result=await db.batch([
 db.prepare(`UPDATE settings SET value=? WHERE key=? AND value=? AND ${permission} AND EXISTS (SELECT 1 FROM ev_documents WHERE id=? AND state='needs_review')`).bind(marker,'rev:'+a.family,rev.value,a.family,a.email,a.user,a.email,doc.id),
 db.prepare(`INSERT OR IGNORE INTO records(id,family,kind,data,author) SELECT ?,?,'transaction',?,? WHERE ${g}`).bind('receipt-tx-'+doc.id,a.family,JSON.stringify({name:receipt.store,type:receipt.type,amount:receipt.total,date:receipt.date,paid:receipt.paid,category:'Outros',paymentMethod:receipt.paymentMethod,receiptId:doc.id,source:'whatsapp',provider:'evolution'}),a.email,...args),
 db.prepare(`UPDATE ev_documents SET state='posted',data=? WHERE id=? AND state='needs_review' AND ${g}`).bind(JSON.stringify({receipt,reason:'Conferido e registrado no aplicativo.'}),doc.id,...args)
 ]);if(!result[2].meta.changes)return json({error:'Os dados mudaram. Atualize e confira antes de tentar novamente.'},409);return json({ok:true});
 }
 if(b.action==='pair'||b.action==='pairGroup'){
 if(!ready(env))return json({error:'Configure a ponte Evolution antes de vincular.'},503);
 if(b.action==='pairGroup'&&!a.admin)return json({error:'Somente o administrador pode vincular grupos.'},403);
 const kind=b.action==='pairGroup'?'group':'person',code=[...crypto.getRandomValues(new Uint8Array(24))].map(x=>x.toString(16).padStart(2,'0')).join(''),expires=new Date(Date.now()+600000).toISOString();
 await db.batch([db.prepare('DELETE FROM ev_pairings WHERE (user=? AND kind=?) OR expires<?').bind(a.user,kind,new Date().toISOString()),db.prepare('INSERT INTO ev_pairings VALUES(?,?,?,?,?,?)').bind(await digest('evolution:'+code),a.user,a.email,a.family,kind,expires)]);
 return json({code,expires,command:(kind==='group'?'Maria, ':'')+'vincular '+code});
 }
 if(b.action==='unlink'){await db.prepare('DELETE FROM ev_links WHERE user=? AND family=?').bind(a.user,a.family).run();return json({ok:true});}
 if(b.action==='unlinkGroup'&&a.admin){await db.prepare('DELETE FROM ev_groups WHERE chat=? AND family=?').bind(b.chat,a.family).run();return json({ok:true});}
 return json({error:'Ação inválida.'},400);
 }catch{return json({error:'Não foi possível concluir. Confira sua conexão e suas permissões.'},403)}}
