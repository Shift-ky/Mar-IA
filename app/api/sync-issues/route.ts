import {getChatGPTUser} from '../../chatgpt-auth';
import {env} from 'cloudflare:workers';

export const dynamic='force-dynamic';
const json=(value:any,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
const validId=(value:any)=>typeof value==='string'&&/^[\w-]{10,100}$/.test(value);

async function context(family:string,request:Request){
 const user=await getChatGPTUser(request);if(!user)throw Error('Entre na sua conta para acessar a sincronização.');
 if(!validId(family))throw Error('Família inválida.');
 const member=await env.DB!.prepare('SELECT role FROM members WHERE family=? AND lower(email)=?').bind(family,user.email.toLowerCase()).first<any>();
 if(!member)throw Error('Sem acesso a esta família.');
 return {user,db:env.DB!,admin:member.role==='admin',family};
}

export async function GET(req:Request){
 try{
  const family=new URL(req.url).searchParams.get('family')||'',c=await context(family,req);
  const prefix=`sync-issue:${family}:`,rows=await c.db.prepare('SELECT key,value FROM settings WHERE substr(key,1,?)=? ORDER BY key').bind(prefix.length,prefix).all<any>();
  const issues=rows.results.map((row:any)=>{try{return JSON.parse(row.value)}catch{return null}}).filter((issue:any)=>issue&&(c.admin||issue.user===c.user.userId));
  return json({issues});
 }catch(e:any){return json({error:e.message},401);}
}

export async function POST(req:Request){
 try{
  const user=await getChatGPTUser(req);if(!user)return json({error:'Entre na sua conta para acessar a sincronização.'},401);
  const body:any=await req.json(),family=String(body.family||'');if(!validId(family))return json({error:'Família inválida.'},400);
  const db=env.DB!,member=await db.prepare('SELECT role FROM members WHERE family=? AND lower(email)=?').bind(family,user.email.toLowerCase()).first<any>();
  if(!member)return json({error:'Sem acesso a esta família.'},403);
  if(body.action==='submit'){
   const op=body.operation;if(!op||op.account!==user.userId||op.family!==family||!validId(op.operationId))return json({error:'Alteração inválida para análise.'},400);
   const key=`sync-issue:${family}:${op.operationId}`,value={family,operationId:op.operationId,user:user.userId,email:user.email.toLowerCase(),state:'pending',error:String(body.error||'Falha ao sincronizar.').slice(0,1000),status:Number.isInteger(body.status)?body.status:null,operation:{action:op.action,kind:op.kind,id:op.id,entityId:op.entityId,data:op.data,createdAt:op.createdAt},createdAt:new Date().toISOString()};
   await db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,JSON.stringify(value)).run();
   return json({ok:true});
  }
  if(body.action==='resolve'){
   if(member.role!=='admin')return json({error:'Apenas o administrador da família pode decidir estas alterações.'},403);
   if(!validId(body.operationId)||!['retry','discard'].includes(body.decision))return json({error:'Decisão inválida.'},400);
   const key=`sync-issue:${family}:${body.operationId}`,row=await db.prepare('SELECT value FROM settings WHERE key=?').bind(key).first<any>();if(!row)return json({error:'Alteração não encontrada.'},404);
   const issue=JSON.parse(row.value);if(issue.state!=='pending')return json({error:'Esta alteração já foi analisada.'},409);
   const updated={...issue,state:body.decision==='retry'?'retry':'discarded',decision:body.decision,decidedBy:user.email.toLowerCase(),decidedAt:new Date().toISOString()};
   const result=await db.prepare("UPDATE settings SET value=? WHERE key=? AND json_extract(value,'$.state')='pending'").bind(JSON.stringify(updated),key).run();
   if(!result.meta.changes)return json({error:'Esta alteração já foi analisada.'},409);
   return json({ok:true,issue:updated});
  }
  return json({error:'Ação inválida.'},400);
 }catch(e:any){return json({error:e.message||'Falha ao salvar a análise.'},500);}
}
