import {financialReceipt,financialExtraction,paymentAnswer} from './financial-receipt';
import {paymentMethods} from '../payment-methods';
import {interactive,mainMenu,back} from './interactive';
import {receiptDeletionPlan,purgeDeletedDocuments} from '../receipt-deletion';
import {automaticProof,declaredPayment} from './automatic-proof';
import {actor,phoneActor} from '../whatsapp/access';
import {digest,verify,boundedBody} from '../whatsapp/crypto';
import {parseCommand,help,summary,money,menuKeyboard,guide,availableSummary,overview,shoppingList,walletBalanceSummary} from './commands';
import {unresolvedReceiptItems,requireReceiptMappings} from '../receipt-mapping';
import {familyRecords} from '../inventory';
import {receiptPlan,validateReceipt,validFiscalKey} from '../whatsapp/receipts';
import {dateEntry} from '../entry-date';
import {messagePaymentFlow} from '../message-payment-flow';
type Runtime=Cloudflare.Env;
const now=()=>new Date().toISOString();
const response=(v:any,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
export function readiness(env:Runtime){const required=['TELEGRAM_BOT_TOKEN','TELEGRAM_WEBHOOK_SECRET','TELEGRAM_BOT_USERNAME','TELEGRAM_JOB_SECRET'];return {configured:required.every(k=>!!(env as any)[k]),missing:required.filter(k=>!(env as any)[k]),extractor:!!env.RECEIPT_EXTRACTOR_URL&&!!env.RECEIPT_EXTRACTOR_TOKEN,privateMedia:!!env.BUCKET};}
// Reconcile subscriptions using server credentials; never replace the existing URL.
export async function enableCallbacks(env:Runtime){
 const current=await telegram(env,'getWebhookInfo',{});
 if(!current.url)throw Error('Webhook não registrado.');
 const allowed=Array.isArray(current.allowed_updates)?current.allowed_updates:[];
 if(!allowed.length||allowed.includes('callback_query'))return {changed:false};
 const result=await telegram(env,'setWebhook',{url:current.url,secret_token:env.TELEGRAM_WEBHOOK_SECRET,allowed_updates:[...new Set([...allowed,'message','callback_query'])],drop_pending_updates:false,...(current.max_connections?{max_connections:current.max_connections}:{})});
 if(!result)throw Error('Não foi possível habilitar os botões.');
 return {changed:true};
}
export async function configureWebhook(env:Runtime,origin:string){
 if(!env.TELEGRAM_BOT_TOKEN||!env.TELEGRAM_WEBHOOK_SECRET)throw Error('Configuração do bot incompleta.');
 const base=new URL(origin);
 if(base.protocol!=='https:'||base.hostname!=='financas-familia-robson.nosborx-costa.chatgpt.site')throw Error('Endereço do Mar IA inválido.');
 const url=new URL('/api/telegram/webhook',base).toString();
 const result=await telegram(env,'setWebhook',{url,secret_token:env.TELEGRAM_WEBHOOK_SECRET,allowed_updates:['message','callback_query'],drop_pending_updates:false});
 if(result!==true)throw Error('Telegram não confirmou o registro do webhook.');
 const info=await telegram(env,'getWebhookInfo',{});
 return {urlMatches:info.url===url,pendingUpdateCount:Number(info.pending_update_count||0),allowedUpdates:Array.isArray(info.allowed_updates)?info.allowed_updates:[],lastErrorDate:info.last_error_date||null,lastErrorMessage:typeof info.last_error_message==='string'?info.last_error_message.slice(0,180):null};
}
export async function webhook(req:Request,env:Runtime,ctx:{waitUntil(p:Promise<any>):void}){
 const receivedAt=performance.now();
 if(req.method!=='POST')return response({error:'Método inválido.'},405);
 if(!env.DB||!env.TELEGRAM_BOT_TOKEN||!env.TELEGRAM_WEBHOOK_SECRET)return response({error:'Telegram ainda não configurado.'},503);
 const supplied=req.headers.get('x-telegram-bot-api-secret-token')||'';
 if(await digest(supplied)!==await digest(env.TELEGRAM_WEBHOOK_SECRET))return response({error:'Acesso negado.'},401);
 let payload:any;try{payload=JSON.parse(await boundedBody(req))}catch{return response({error:'Payload inválido ou grande demais.'},400)}
 if(!Number.isSafeInteger(payload.update_id)||payload.update_id<0)return response({error:'Update inválido.'},400);
 const callback=payload.callback_query;
 const input=callback?{...callback.message,from:callback.from,text:''}:payload.message;
 // Never accept groups, channels, bots or an identity different from the private chat.
 if(!input||input.chat?.type!=='private'||input.from?.is_bot||!Number.isSafeInteger(input.from?.id)||input.from.id<=0||input.chat.id!==input.from.id)return response({received:true});
 const id='tg:'+payload.update_id,from='tg:'+input.from.id;
 let text=typeof input.text==='string'&&input.text.trim()?input.text:typeof input.caption==='string'?input.caption.slice(0,1024):'';
 const file=input.document||input.photo?.at(-1);
 const mime=input.document?.mime_type||(input.photo?.length?'image/jpeg':null);
 let m:any={id,from,timestamp:input.date,type:'text',text:{body:text}};
 if(callback){if(typeof callback.data!=='string'||!callback.data.startsWith('mi:')||callback.data.length>64)return response({received:true});m.callback=callback.data;m.messageId=input.message_id;ctx.waitUntil(telegram(env,'answerCallbackQuery',{callback_query_id:callback.id}).catch(()=>{}))}
 if(input.contact){m.type='contact';m.contact={userId:input.contact.user_id,phone:input.contact.phone_number};}
 if(file&&typeof file.file_id==='string'&&file.file_id.length<=1024&&['image/jpeg','image/png','application/pdf'].includes(mime)){
  m={...m,type:input.document?'document':'image',[input.document?'document':'image']:{id:file.file_id}};
 }else if(file)m.text={body:'ajuda'};
 const queued=await env.DB.prepare(`INSERT OR IGNORE INTO wa_inbox(id,phone,payload,state,created)
 VALUES(?,?,json_set(?, '$.context',json((SELECT json_object('family',family,'user',user) FROM wa_links WHERE phone=?)),
 '$.messageFamily',(SELECT json_extract(body,'$.family') FROM wa_outbox WHERE phone=? AND provider_id=? ORDER BY rowid DESC LIMIT 1)), 'queued',?)
 RETURNING id,phone,payload,created`).bind(id,from,JSON.stringify(m),from,from,String(m.messageId||''),now()).first<any>();
 if(!callback&&/^(oi|olá|ola|\/start|\/menu)$/i.test(text.trim()))ctx.waitUntil(enableCallbacks(env).catch(()=>{console.error('telegram_callback_subscription_failed')}));
 ctx.waitUntil(queued?processIncoming(env,{...queued,receivedAt}):processJobs(env,from));return response({received:true});
}
export async function jobs(req:Request,env:Runtime,ctx:{waitUntil(p:Promise<any>):void}){
 if(!env.TELEGRAM_JOB_SECRET)return response({error:'Recurso indisponível.'},503);
 let body:string;try{body=await boundedBody(req,2048)}catch{return response({error:'Payload inválido.'},413)}
 if(!await verify(env.TELEGRAM_JOB_SECRET,body,req.headers.get('x-mar-job-signature')))return response({error:'Acesso negado.'},401);
 let data:any;try{data=JSON.parse(body)}catch{return response({error:'Inválido.'},400)}
 if(req.method!=='POST'||!Number.isFinite(data.at)||Math.abs(Date.now()-data.at)>300000)return response({error:'Solicitação expirada.'},401);
 if(typeof data.reextract==='string'){try{const doc=await reextractPdfDocument(env,data.reextract);return response({id:doc.id,state:doc.state,data:JSON.parse(doc.data)})}catch{return response({error:'Não foi possível reler este PDF.'},400)}}
 if(data.diagnostic===true){try{const bot=await telegram(env,'getMe',{});return response({ok:true,username:bot.username})}catch(e:any){return response({ok:false,error:e.message},502)}}
 ctx.waitUntil(processJobs(env));return response({queued:true});
}
async function telegram(env:Runtime,method:string,data:any){
 if(!env.TELEGRAM_BOT_TOKEN||!/^\d+:[a-zA-Z0-9_-]+$/.test(env.TELEGRAM_BOT_TOKEN))throw Error('Token do bot não configurado.');
 let result:Response;
 try{result=await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),redirect:'manual',signal:AbortSignal.timeout(15000)})}catch{throw Error('Telegram '+method+': conexão indisponível ou expirada.')}
 let payload:any;try{payload=await result.json()}catch{throw Error('Telegram '+method+': HTTP '+result.status+' sem resposta JSON.')}
 if(!result.ok||!payload.ok){const detail=String(payload.description||'solicitação recusada').replaceAll(env.TELEGRAM_BOT_TOKEN,'[segredo]').slice(0,180);throw Error('Telegram '+method+': HTTP '+result.status+' · '+detail)}return payload.result;
}
async function download(env:Runtime,id:string){
 if(!/^[a-zA-Z0-9_-]{1,1024}$/.test(id))throw Error('Identificador de arquivo inválido.');
 const info=await telegram(env,'getFile',{file_id:id});
 if(typeof info.file_path!=='string'||!info.file_path.split('/').every((s:string)=>/^[a-zA-Z0-9_.-]+$/.test(s)&&s!=='.'&&s!=='..'))throw Error('Endereço de arquivo inválido.');
 if(info.file_size>10485760)throw Error('Documento maior que 10 MB.');
 const media=await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${info.file_path}`,{redirect:'manual',signal:AbortSignal.timeout(15000)});
 if(!media.ok||!media.body)throw Error('Falha ao baixar arquivo do Telegram.');
 if(Number(media.headers.get('content-length')||0)>10485760)throw Error('Documento maior que 10 MB.');
 const reader=media.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>10485760){await reader.cancel();throw Error('Documento maior que 10 MB.')}chunks.push(value)}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
 const mime=bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff?'image/jpeg':bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71?'image/png':new TextDecoder().decode(bytes.slice(0,5))==='%PDF-'?'application/pdf':null;
 if(!mime)throw Error('Envie um cupom em JPEG, PNG ou PDF.');return {bytes,mime};
}

export async function reextractPdfDocument(env:Runtime,id:string){
 if(!/^tg-doc-[a-f0-9]{64}$/.test(id)||!env.DB||!env.BUCKET)throw Error('Documento inválido.');
 const doc=await env.DB.prepare('SELECT * FROM wa_documents WHERE id=?').bind(id).first<any>();
 if(!doc||doc.mime!=='application/pdf'||doc.state!=='needs_review')throw Error('Documento indisponível para leitura.');
 const current=JSON.parse(doc.data);if(current.receipt)return doc;
 const file=await env.BUCKET.get(doc.storage);if(!file||file.size>10485760)throw Error('Arquivo indisponível.');
 const extracted=await(await import('./pdf-receipt')).extractPdfReceipt(new Uint8Array(await file.arrayBuffer()),true);
 const result={...financialExtraction(extracted),...(current.paymentMethod?{paymentMethod:current.paymentMethod}:{}),paymentAsked:current.paymentAsked===true};
 await env.DB.prepare("UPDATE wa_documents SET data=? WHERE id=? AND state='needs_review' AND data=?").bind(JSON.stringify(result),id,doc.data).run();
 return env.DB.prepare('SELECT * FROM wa_documents WHERE id=?').bind(id).first<any>();
}
async function document(env:Runtime,m:any,a:any){
 if(!env.BUCKET)throw Error('Armazenamento privado não configurado.');
 const {bytes,mime}=await download(env,(m.image||m.document).id),hash=await digest(bytes.buffer),db=env.DB!;
 const existing=await db.prepare("SELECT * FROM wa_documents WHERE family=? AND hash=? AND state NOT IN ('deleted','rejected','duplicate') LIMIT 1").bind(a.family,hash).first<any>();
 if(existing){if(!await env.BUCKET.get(existing.storage))await env.BUCKET.put(existing.storage,bytes,{httpMetadata:{contentType:mime}});return existing;}
 const id='tg-doc-'+await digest(a.family+':'+hash+':'+m.id),storage='receipts/'+a.family+'/'+hash+'/'+id;
 let extracted:any={reason:'A imagem não pôde ser lida automaticamente. Complete o valor em Pendências.'};
 if(env.RECEIPT_EXTRACTOR_URL&&env.RECEIPT_EXTRACTOR_TOKEN){try{const endpoint=new URL(env.RECEIPT_EXTRACTOR_URL);if(endpoint.protocol!=='https:')throw Error();const r=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+env.RECEIPT_EXTRACTOR_TOKEN,'Content-Type':mime,'X-Document-SHA256':hash,'X-Extraction-Mode':'financial-total-only'},body:bytes,redirect:'manual',signal:AbortSignal.timeout(18000)});if(!r.ok)throw Error();extracted=await r.json();}catch{extracted={reason:'Não consegui ler o documento. Complete os dados em Pendências.'};}}
 else if(mime==='application/pdf')extracted=await(await import('./pdf-receipt')).extractPdfReceipt(bytes,true);
 const data=financialExtraction(extracted);
 await db.prepare("INSERT OR IGNORE INTO wa_documents SELECT ?,?,?,?,?,?,?,'needs_review',?,? WHERE NOT EXISTS (SELECT 1 FROM wa_documents WHERE family=? AND hash=? AND state NOT IN ('deleted','rejected','duplicate'))").bind(id,a.family,a.user,m.from,hash,storage,mime,JSON.stringify(data),now(),a.family,hash).run();
 const saved=await db.prepare("SELECT * FROM wa_documents WHERE family=? AND hash=? AND state NOT IN ('deleted','rejected','duplicate') LIMIT 1").bind(a.family,hash).first<any>();if(!saved)throw Error('Tente enviar o documento novamente.');
 await env.BUCKET.put(saved.storage,bytes,{httpMetadata:{contentType:mime}});return saved;
}
function receiptPaymentKeyboard(id:string){return {inline_keyboard:paymentMethods.map((name,i)=>[{text:name,callback_data:'mi:receiptpay:'+id.slice(-24)+':'+i}])};}
async function payDocument(env:Runtime,event:any,lease:string,a:any,base:string,m:any){
 if(m.type!=='text'&&!m.callback)return false;
 const callback=m.callback?.match(/^mi:receiptpay:([a-f0-9]{24}):(\d+)$/),answer=paymentAnswer(m.text?.body||'');if(!callback&&!answer)return false;
 const db=env.DB!;let doc:any;
 if(callback)doc=await db.prepare('SELECT * FROM wa_documents WHERE family=? AND user=? AND phone=? AND substr(id,-24)=? LIMIT 1').bind(a.family,a.user,event.phone,callback[1]).first<any>();
 else{const active=await db.prepare('SELECT value FROM settings WHERE key=?').bind('tg-receipt-active:'+event.phone).first<any>();if(active){const selected=JSON.parse(active.value);if(selected.family===a.family&&selected.user===a.user)doc=await db.prepare('SELECT * FROM wa_documents WHERE id=? AND family=? AND user=? AND phone=?').bind(selected.id,a.family,a.user,event.phone).first<any>();}}
 if(!doc){if(callback)throw Error('Documento indisponível. Ele pode ter sido excluído.');return false;}
 if(!a.permissions.add)throw Error('Sem permissão para registrar documentos.');
 const method=callback?paymentMethods[Number(callback[2])]:answer;if(!method)throw Error('Forma de pagamento inválida.');
 const data=JSON.parse(doc.data);if(doc.state==='posted'){await finish(env,event,lease,a,base,[],'Este documento já foi registrado. Nenhum lançamento foi duplicado.');return true;}
 if(doc.state!=='needs_review')throw Error('Documento indisponível. Reenvie o arquivo.');
 if(!data.paymentAsked)throw Error('Reenvie o documento para selecionar a forma de pagamento.');
 const clear={sql:'DELETE FROM settings WHERE key=? AND $GUARD',args:['tg-receipt-active:'+event.phone]};
 if(!data.receipt){await finish(env,event,lease,a,base,[],'Forma de pagamento salva: '+method+'. O documento está em Pendências. Complete o valor e a data para registrar.',[clear,{sql:"UPDATE wa_documents SET data=? WHERE id=? AND state='needs_review' AND $GUARD",args:[JSON.stringify({...data,paymentMethod:method}),doc.id]}],'add');return true;}
 const receipt=financialReceipt({...data.receipt,paymentMethod:method},true);
 await finish(env,event,lease,a,base,[{id:'receipt-tx-'+doc.id,kind:'transaction',data:{name:receipt.store,type:receipt.type,amount:receipt.total,date:receipt.date,paid:data.paid!==false,category:data.category||'Outros',paymentMethod:method,receiptId:doc.id,source:'telegram'}}],'Documento registrado: '+money(receipt.total)+' · '+method+'.',[clear,{sql:"UPDATE wa_documents SET state='posted',data=? WHERE id=? AND $GUARD",args:[JSON.stringify({...data,receipt,paymentMethod:method,reason:'Registrado após informar a forma de pagamento.'}),doc.id]}],'add',{sql:"EXISTS (SELECT 1 FROM wa_documents WHERE id=? AND state='needs_review')",args:[doc.id]});return true;
}
async function revision(db:D1Database,family:string){const existing=await db.prepare('SELECT value FROM settings WHERE key=?').bind('rev:'+family).first<any>();if(existing)return existing.value;await db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,'0')").bind('rev:'+family).run();return (await db.prepare('SELECT value FROM settings WHERE key=?').bind('rev:'+family).first<any>()).value;}
function insertedRecord(db:any,row:any,a:any,guard:string,g:any[]){return db.prepare(`INSERT INTO records SELECT ?,?,?,?,? WHERE ${guard}`).bind(row.id,a.family,row.kind,JSON.stringify(row.data),a.email,...g);}
async function finish(env:Runtime,event:any,lease:string,a:any,base:string|null,rows:any[],reply:string,extra:any[]=[],permission='',condition?:{sql:string,args:any[],consumeHash?:string},markup?:any){rows=rows.map((row:any)=>row.kind==='transaction'?{...row,data:dateEntry(row.data)}:row);if(a?.familyName)reply='Família: '+a.familyName+'\n\n'+reply;const db=env.DB!;let guard="EXISTS (SELECT 1 FROM wa_inbox WHERE id=? AND lease=? AND state='processing')";const g:any[]=[event.id,lease];const batch:any[]=[];if(a){guard+=' AND EXISTS (SELECT 1 FROM settings WHERE key=? AND value=?)';g.push('rev:'+a.family,rows.length||extra.length||condition?'wa:'+event.id:base);if(rows.length||extra.length||condition)batch.push(db.prepare(`UPDATE settings SET value=? WHERE key=? AND value=? AND EXISTS (SELECT 1 FROM wa_inbox WHERE id=? AND lease=?) AND EXISTS (SELECT 1 FROM profiles WHERE id=? AND email=?) AND EXISTS (SELECT 1 FROM members WHERE family=? AND email=? AND (role='admin' OR ?='' OR json_extract(permissions,?)=1))${condition?' AND '+condition.sql:''}`).bind('wa:'+event.id,'rev:'+a.family,base,event.id,lease,a.user,a.email,a.family,a.email,permission,'$.'+(permission||'view'),...(condition?.args||[])));}for(const row of rows)batch.push(insertedRecord(db,row,a,guard,g));for(const ex of extra)batch.push(db.prepare(ex.sql.replace('$GUARD',guard)).bind(...ex.args,...g));const received=Number(JSON.parse(event.payload).timestamp);const created=Number.isFinite(received)&&received>0?new Date(received*1000).toISOString():event.created;const outgoing={receivedAt:event.receivedAt,id:'reply-'+event.id,phone:event.phone,body:JSON.stringify({text:reply,...(markup?{markup}:{}),...(JSON.parse(event.payload).messageId?{messageId:JSON.parse(event.payload).messageId}:{}),...(a?{family:a.family,user:a.user,email:a.email,permission}:{})}),created};batch.push(db.prepare(`INSERT OR IGNORE INTO wa_outbox(id,phone,body,state,created) SELECT ?,?,?,'queued',? WHERE ${guard}`).bind(outgoing.id,outgoing.phone,outgoing.body,created,...g));const completionIndex=batch.length;batch.push(db.prepare(`UPDATE wa_inbox SET state='done',payload='{}',error=NULL WHERE id=? AND ${guard}`).bind(event.id,...g));if(condition?.consumeHash)batch.push(db.prepare("DELETE FROM wa_pairings WHERE hash=? AND EXISTS (SELECT 1 FROM wa_inbox WHERE id=? AND lease=? AND state='done')").bind(condition.consumeHash,event.id,lease));const results=await db.batch(batch);if(!results[completionIndex]?.meta.changes)throw Error('Conflito de sincronização; nova tentativa necessária.');await sendOutbox(env,outgoing);}
async function pair(env:Runtime,event:any,lease:string,code:string){const db=env.DB!,hash=await digest('telegram:'+code);const pairing=await db.prepare('SELECT * FROM wa_pairings WHERE hash=? AND expires>?').bind(hash,now()).first<any>();if(!pairing)throw Error('Código inválido ou expirado. Gere outro código no aplicativo.');const a=await actor(db,pairing.user,pairing.email,pairing.family);const base=await revision(db,a.family);await finish(env,event,lease,a,base,[],'Telegram vinculado à sua conta Mar IA. Envie ajuda para ver os comandos.',[{sql:'INSERT INTO wa_links(phone,user,email,family) SELECT ?,?,?,? WHERE $GUARD ON CONFLICT(phone) DO UPDATE SET user=excluded.user,email=excluded.email,family=excluded.family',args:[event.phone,a.user,a.email,a.family]},{sql:'DELETE FROM settings WHERE key IN (?,?) AND $GUARD',args:['tg-flow:'+event.phone,'tg-shopping-view:'+event.phone]}],'', {sql:'EXISTS (SELECT 1 FROM wa_pairings WHERE hash=? AND expires>?)',args:[hash,now()],consumeHash:hash});}
async function activateContact(env:Runtime,event:any,lease:string,m:any){
 const db=env.DB!,userId=Number(event.phone.slice(3));
 if(!Number.isSafeInteger(m.contact?.userId)||m.contact.userId!==userId)throw Error('Use o botão Confirmar meu telefone. Contatos de outras pessoas não ativam sua conta.');
 const phone=String(m.contact.phone||'').replace(/\D/g,'');if(!/^\d{10,15}$/.test(phone))throw Error('Telefone inválido.');
 const key='tg-activation:'+event.phone,stored=await db.prepare('SELECT value FROM settings WHERE key=?').bind(key).first<any>();
 const pending=stored?JSON.parse(stored.value):null;if(!pending||pending.expires<Date.now())throw Error('Abra novamente o link da família para ativar seu chat.');
 const profiles=await db.prepare('SELECT id,email,name FROM profiles WHERE phone=? LIMIT 2').bind('+'+phone).all();
 if(profiles.results.length!==1)throw Error(profiles.results.length?'Esse telefone está em mais de uma conta. Corrija seu cadastro na Mar IA antes de ativar.':'Este telefone não está cadastrado. Cadastre seu telefone pessoal, com código do país, na Mar IA.');
 const profile:any=profiles.results[0];const oldLink=await db.prepare('SELECT user FROM wa_links WHERE phone=?').bind(event.phone).first<any>();
 if(oldLink&&oldLink.user!==profile.id)throw Error('Este Telegram já está vinculado a outra conta. Desvincule a conta anterior na aplicação antes de continuar.');
 let a;try{a=await actor(db,profile.id,profile.email,pending.family)}catch{throw Error('Seu cadastro foi identificado, mas você ainda não tem acesso a esta família. Solicite entrada pelo código '+pending.family+' no aplicativo e aguarde a aprovação.');}
 const base=await revision(db,a.family);
 await finish(env,event,lease,a,base,[],'Telefone confirmado. Chat ativado para sua conta e para esta família. Escolha o que deseja fazer:',[
 {sql:'INSERT INTO wa_links(phone,user,email,family) SELECT ?,?,?,? WHERE $GUARD ON CONFLICT(phone) DO UPDATE SET user=excluded.user,email=excluded.email,family=excluded.family',args:[event.phone,a.user,a.email,a.family]},
 {sql:'DELETE FROM settings WHERE key IN (?,?,?) AND $GUARD',args:[key,'tg-flow:'+event.phone,'tg-shopping-view:'+event.phone]}
 ],'',{sql:'EXISTS (SELECT 1 FROM settings WHERE key=? AND value=?) AND EXISTS (SELECT 1 FROM profiles WHERE id=? AND phone=?)',args:[key,stored.value,profile.id,'+'+phone]},mainMenu);
}
async function selectLinkedFamily(env:Runtime,event:any,lease:string,code:string){
 const db=env.DB!;
 const selector=await db.prepare("SELECT key FROM settings WHERE key LIKE 'tg-family-code:%' AND value=? LIMIT 1").bind(code).first<any>();
 if(!selector)throw Error('Link da família inválido. Peça o link ao administrador.');
 const family=selector.key.slice('tg-family-code:'.length);
 const link=await db.prepare('SELECT * FROM wa_links WHERE phone=?').bind(event.phone).first<any>();
 if(!link){const pending={family,expires:Date.now()+600000};await finish(env,event,lease,null,null,[],'Para ativar o chat desta família, confirme seu telefone pelo botão abaixo. Ele precisa ser o telefone cadastrado na sua conta Mar IA. Se ainda não tem acesso à família, solicite entrada no aplicativo com o código '+family+'.',[{sql:'INSERT INTO settings(key,value) SELECT ?,? WHERE $GUARD ON CONFLICT(key) DO UPDATE SET value=excluded.value',args:['tg-activation:'+event.phone,JSON.stringify(pending)]}],'',undefined,{keyboard:[[{text:'Confirmar meu telefone',request_contact:true}]],resize_keyboard:true,one_time_keyboard:true});return;}
 let a;try{a=await actor(db,link.user,link.email,family)}catch{throw Error('Você ainda não tem acesso a esta família. Complete o cadastro na Mar IA, solicite entrada com o código '+family+' e aguarde a aprovação do administrador.');}const base=await revision(db,family);
 await finish(env,event,lease,a,base,[],'Esta é a família ativa neste chat. Os próximos lançamentos e consultas serão feitos nesta família.\nEnvie /menu para continuar.',[
 {sql:'UPDATE wa_links SET family=? WHERE phone=? AND user=? AND $GUARD',args:[family,event.phone,a.user]},
 {sql:'DELETE FROM settings WHERE key IN (?,?) AND $GUARD',args:['tg-flow:'+event.phone,'tg-shopping-view:'+event.phone]}
 ],'',{sql:'EXISTS (SELECT 1 FROM wa_links WHERE phone=? AND user=? AND email=?)',args:[event.phone,link.user,link.email]});
}
async function processOne(env:Runtime,event:any){const db=env.DB!,lease=crypto.randomUUID();const acquired=await db.prepare("UPDATE wa_inbox SET state='processing',lease=?,expires=? WHERE id=? AND (state='queued' OR (state='processing' AND expires<?)) AND NOT EXISTS (SELECT 1 FROM wa_inbox AS previous WHERE previous.phone=? AND previous.rowid<(SELECT rowid FROM wa_inbox WHERE id=?) AND previous.state IN ('queued','processing')) AND NOT EXISTS (SELECT 1 FROM wa_outbox WHERE phone=? AND state IN ('queued','sending'))").bind(lease,new Date(Date.now()+120000).toISOString(),event.id,now(),event.phone,event.id,event.phone).run();if(!acquired.meta.changes)return false;const m=JSON.parse(event.payload);try{const command=parseCommand(m.text?.body||'');if(m.type==='contact'){await activateContact(env,event,lease,m);return;}if(command.action==='pair'){await pair(env,event,lease,command.code);return;}if(command.action==='familyLink'){await selectLinkedFamily(env,event,lease,command.code);return;}const a=await phoneActor(db,event.phone,true);if(m.context&&(m.context.user!==a.user||m.context.family!==a.family))throw Error('A família ativa mudou enquanto esta mensagem aguardava processamento. Envie /menu e repita a solicitação na família correta.');if(m.callback&&m.messageFamily&&m.messageFamily!==a.family)throw Error('Este botão pertence a outra família. Envie /menu para usar a família ativa.');const base=a.revision??await revision(db,a.family);const savedFlow=a.savedFlow;let cachedRecords:Promise<any[]>|undefined;const getRecords=()=>cachedRecords??=familyRecords(db,a.family);
if(await payDocument(env,event,lease,a,base,m))return;
if(await interactive({db,event,m,a,base,savedFlow,getRecords,finish:(text:any,markup:any,extra:any[],permission:string,rows:any[])=>finish(env,event,lease,a,base,rows,text,extra,permission,undefined,markup)}))return;
if(m.type==='text'&&!m.callback&&['help','guide'].includes(command.action)){await finish(env,event,lease,a,base,[],command.action==='guide'?guide(command.topic):help);return;}
const records=await getRecords();
if(m.callback){const map:any={'mi:balance':'balance','mi:movements':'movements','mi:report':'report'};if(!map[m.callback])throw Error('Botão expirado. Envie /menu.');Object.assign(command,{action:map[m.callback]});}

if(command.action==='receipts'){if(!a.permissions.view&&!a.permissions.delete)throw Error('Sem permissão para consultar cupons.');const docs=await db.prepare("SELECT id,state,data,created FROM wa_documents WHERE family=? AND state<>'deleted' AND (?=1 OR user=?) ORDER BY created DESC LIMIT 10").bind(a.family,a.permissions.view?1:0,a.user).all();const list=docs.results.map((d:any)=>{const data=JSON.parse(d.data);return (data.receipt?.store||data.draft?.store||'Documento recebido')+' · '+d.created.slice(0,10)+' · '+(d.state==='posted'?'Registrado':d.state==='rejected'?'Descartado':'Pendente')+'\nID: '+d.id;}).join('\n\n');await finish(env,event,lease,a,base,[],list?'Cupons e comprovantes recentes:\n\n'+list+'\n\nPara excluir, envie: excluir cupom ID\nSe já registrado, a despesa e as entradas de estoque vinculadas serão removidas.':'Nenhum cupom ou comprovante encontrado.');return;}
if(command.action==='receiptDelete'){if(!a.permissions.delete)throw Error('Sem permissão para excluir cupons.');const doc=await db.prepare('SELECT * FROM wa_documents WHERE id=? AND family=?').bind(command.documentId,a.family).first<any>();if(!doc||(!a.permissions.view&&doc.user!==a.user))throw Error('Documento não encontrado ou já excluído.');if(doc.state==='deleted'){await finish(env,event,lease,a,base,[],'Este cupom já foi excluído.');return;}receiptDeletionPlan(records,doc.id);await finish(env,event,lease,a,base,[],'Cupom excluído. O documento e o lançamento foram removidos. Você pode enviar o arquivo novamente.',[{sql:"DELETE FROM records WHERE family=? AND json_extract(data,'$.receiptId')=? AND kind IN ('transaction','purchaseItem','stockMovement') AND $GUARD",args:[a.family,doc.id]},{sql:"UPDATE wa_documents SET state='deleted',data=? WHERE id=? AND family=? AND $GUARD",args:[JSON.stringify({deletedAt:now()}),doc.id,a.family]},{sql:"DELETE FROM settings WHERE key LIKE 'tg-receipt-active:%' AND json_extract(value,'$.id')=? AND $GUARD",args:[doc.id]}],'delete',{sql:"EXISTS (SELECT 1 FROM wa_documents WHERE id=? AND family=? AND state<>'deleted')",args:[doc.id,a.family]});await purgeDeletedDocuments(env);return;}
if(m.type==='image'||m.type==='document'){
 if(!a.permissions.add)throw Error('Sem permissão para registrar documentos.');
 const doc=await document(env,m,a);if(doc.state==='posted'){await finish(env,event,lease,a,base,[],'Este documento já foi registrado. Nenhum lançamento foi duplicado.');return;}
 if(doc.user!==a.user||doc.phone!==event.phone){await finish(env,event,lease,a,base,[],'Este documento já foi recebido nesta família. Consulte os lançamentos e as pendências.');return;}
 const data={...JSON.parse(doc.data),paymentAsked:true};

 await finish(env,event,lease,a,base,[],(data.receipt?'Valor identificado: '+money(data.receipt.total)+'.':'O documento foi salvo em Pendências porque a leitura está incompleta.')+' Qual é a forma de pagamento?',[
 {sql:'UPDATE wa_documents SET data=? WHERE id=? AND $GUARD',args:[JSON.stringify(data),doc.id]},
 {sql:'INSERT INTO settings(key,value) SELECT ?,? WHERE $GUARD ON CONFLICT(key) DO UPDATE SET value=excluded.value',args:['tg-receipt-active:'+event.phone,JSON.stringify({id:doc.id,family:a.family,user:a.user})]},
 {sql:'DELETE FROM settings WHERE key=? AND $GUARD',args:['tg-flow:'+event.phone]}
 ],'add',undefined,receiptPaymentKeyboard(doc.id));return;
}
if(await messagePaymentFlow({db,event,a,base,records,text:m.text?.body||'',candidate:command.action==='transaction'?command.data:null,finish:(rows:any[],text:string,extra:any[]=[],permission='add')=>finish(env,event,lease,a,base,rows,text,extra,permission)}))return;
if(command.action==='confirm'||command.action==='cancel'){const doc=await db.prepare("SELECT * FROM wa_documents WHERE id=? AND family=? AND user=? AND phone=? AND state IN ('needs_review','verified')").bind(command.id,a.family,a.user,event.phone).first<any>();if(doc){if(!a.permissions.add)throw Error('Sem permissão para registrar.');const extracted=JSON.parse(doc.data);if(!extracted.confirmationOffered||!extracted.receipt)throw Error('Complete a revisão deste documento no aplicativo.');const receipt=financialReceipt(extracted.receipt,true);const duplicate=receipt.fiscalKey?await db.prepare("SELECT id FROM wa_documents WHERE family=? AND state='posted' AND id<>? AND json_extract(data,'$.receipt.fiscalKey')=?").bind(a.family,doc.id,receipt.fiscalKey).first():null;if(duplicate)throw Error('Este cupom fiscal já foi registrado.');await finish(env,event,lease,a,base,command.action==='confirm'?receiptPlan(receipt,records,doc.id,'telegram').rows:[],command.action==='confirm'?'Compra confirmada. Lançamento financeiro registrado.':'Documento descartado sem lançar compra.',[{sql:'UPDATE wa_documents SET state=? WHERE id=? AND $GUARD',args:[command.action==='confirm'?'posted':'rejected',doc.id]}],'add',{sql:"EXISTS (SELECT 1 FROM wa_documents WHERE id=? AND state IN ('needs_review','verified'))",args:[doc.id]});return;}const draft=await db.prepare("SELECT * FROM wa_drafts WHERE id=? AND family=? AND user=? AND phone=? AND state='pending'").bind(command.id,a.family,a.user,event.phone).first<any>();if(!draft)throw Error('Confirmação não encontrada, já processada ou pertencente a outro usuário.');if(!a.permissions.add)throw Error('Sem permissão para registrar.');const data=JSON.parse(draft.data);if(command.action==='confirm'&&!String(data.paymentMethod||'').trim())throw Error('Este lançamento pendente não tem forma de pagamento. Edite-o no aplicativo antes de confirmar.');await finish(env,event,lease,a,base,command.action==='confirm'?[{id:'wa-tx-'+draft.id,kind:'transaction',data:{...data,waMessageId:draft.id}}]:[],command.action==='confirm'?'Lançamento confirmado.':'Lançamento cancelado.',[{sql:'UPDATE wa_drafts SET state=? WHERE id=? AND $GUARD',args:[command.action==='confirm'?'confirmed':'cancelled',draft.id]}],'add',{sql:"EXISTS (SELECT 1 FROM wa_drafts WHERE id=? AND state='pending')",args:[draft.id]});return;}
if(command.action==='paymentDeclaration'||command.declaredPayment){
if(!a.permissions.add)throw Error('Sem permissão para registrar despesas.');
const pending=await db.prepare("SELECT * FROM wa_documents WHERE family=? AND user=? AND phone=? AND state='needs_review' AND (json_extract(data,'$.draft.proof')=1 OR json_extract(data,'$.receipt.proof')=1) ORDER BY created DESC LIMIT 2").bind(a.family,a.user,event.phone).all();
if(pending.results.length>1)throw Error('Há mais de um comprovante aguardando dados. Reenvie o arquivo desejado com a forma de pagamento na legenda para identificar qual registrar.');
if(pending.results.length===1){const pendingDoc:any=pending.results[0];const current=JSON.parse(pendingDoc.data);const candidate=current.receipt||current.draft;const paymentMethod=command.paymentMethod||command.data.paymentMethod;
if(command.data&&Math.round(command.data.amount*100)!==Math.round(candidate.total*100))throw Error('O valor informado difere do comprovante aguardando dados. Reenvie o documento com a forma de pagamento na legenda para conferir.');
const receipt=validateReceipt({...candidate,paymentMethod});const plan=receiptPlan(receipt,records,pendingDoc.id,'telegram');
await finish(env,event,lease,a,base,plan.rows,'Comprovante registrado automaticamente: '+money(receipt.total)+' · '+paymentMethod+'.',[{sql:"UPDATE wa_documents SET state='posted',data=? WHERE id=? AND $GUARD",args:[JSON.stringify({receipt:plan.data,reason:'Registrado automaticamente após informar a forma de pagamento no Telegram.'}),pendingDoc.id]}],'add',{sql:"EXISTS (SELECT 1 FROM wa_documents WHERE id=? AND state='needs_review')",args:[pendingDoc.id]});return;}
if(command.action==='paymentDeclaration')throw Error('Informe também o valor. Exemplos: 50 em dinheiro, 50 alimentação ou 50 refeição.');
}
if(command.action==='transaction'){if(!a.permissions.add)throw Error('Sem permissão para registrar receitas ou despesas.');const d=command.data;const duplicate=records.some(r=>r.kind==='transaction'&&r.date===d.date&&r.type===d.type&&Number(r.amount)===d.amount&&r.name.trim().toLowerCase()===d.name.trim().toLowerCase());if(duplicate&&!command.declaredPayment){const id=await digest(event.id);await finish(env,event,lease,a,base,[],`Há um lançamento semelhante. Para registrar outra movimentação, envie confirmar ${id}. Para descartar, cancelar ${id}.`,[{sql:"INSERT OR IGNORE INTO wa_drafts SELECT ?,?,?,?,?,'pending',? WHERE $GUARD",args:[id,a.family,a.user,event.phone,JSON.stringify(d),now()]}]);}else await finish(env,event,lease,a,base,[{id:'wa-tx-'+await digest(event.id),kind:'transaction',data:{...d,waMessageId:event.id}}],`${d.type==='income'?'Receita':'Despesa'} registrada: ${money(d.amount)} · ${d.name}` ,[],'add');return;}
if(['balance','report','movements','available','overview','shopping','walletBalance'].includes(command.action)){if(!a.permissions.view)throw Error('Sem permissão para consultar informações financeiras.');const reply=command.action==='shopping'?shoppingList(records,command.page):['available','balance'].includes(command.action)?availableSummary(records):command.action==='walletBalance'?walletBalanceSummary(records,command.wallet):command.action==='overview'?overview(records):command.action==='movements'?'Últimas movimentações:\n'+records.filter(r=>r.kind==='transaction').sort((x,y)=>y.date.localeCompare(x.date)).slice(0,10).map(r=>`${r.date} · ${r.name} · ${r.type==='expense'?'-':'+'}${money(r.amount)}`).join('\n'):summary(records,command.month);await finish(env,event,lease,a,base,[],reply,[],'view');return;}await finish(env,event,lease,a,base,[],help);
}catch(e:any){if(String(e.message).includes('Conflito de sincronização')){await db.prepare("UPDATE wa_inbox SET state='queued',error='Conflito; aguardando nova tentativa' WHERE id=? AND lease=?").bind(event.id,lease).run();return;}await finish(env,event,lease,null,null,[],'Mar IA: '+String(e.message).slice(0,350));}}
async function sendOutbox(env:Runtime,row:any){
 if(!env.TELEGRAM_BOT_TOKEN||!/^tg:[1-9]\d*$/.test(row.phone))return;
 const db=env.DB!,data=JSON.parse(row.body);
 // Claim delivery and revalidate the current identity, link and permission atomically.
 const access=`EXISTS (SELECT 1 FROM wa_links l
 JOIN families f ON f.id=l.family
 JOIN profiles p ON p.id=l.user AND p.email=lower(l.email) AND p.phone IS NOT NULL
 LEFT JOIN settings o ON o.key='owner'
 LEFT JOIN members m ON m.family=l.family AND m.email=lower(l.email)
 WHERE l.phone=? AND l.user=? AND lower(l.email)=? AND l.family=?
 AND (m.id IS NOT NULL AND (m.role='admin' OR ?='' OR json_extract(m.permissions,?)=1)))`;
 const args=data.family?[row.phone,data.user,data.email,data.family,data.permission||'','$.'+(data.permission||'view')]:[];
 const lease=await db.prepare("UPDATE wa_outbox SET state='sending',attempted=? WHERE id=? AND state='queued'"+(data.family?' AND '+access:'')).bind(now(),row.id,...args).run();
 if(!lease.meta.changes){if(data.family)await db.prepare("UPDATE wa_outbox SET state='blocked',error='Acesso revogado antes do envio.' WHERE id=? AND state='queued' AND NOT "+access).bind(row.id,...args).run();return;}
 try{const sent=await telegram(env,data.messageId?'editMessageText':'sendMessage',{chat_id:row.phone.slice(3),...(data.messageId?{message_id:data.messageId}:{}),text:data.text.slice(0,4000),reply_markup:data.markup||back});if(!Number.isSafeInteger(sent.message_id))throw Error('Confirmação de envio ausente.');if(Number.isFinite(row.receivedAt))console.info('telegram_reply_timing_ms',Math.round(performance.now()-row.receivedAt));await db.prepare("UPDATE wa_outbox SET state='sent',provider_id=?,error=NULL WHERE id=?").bind(String(sent.message_id),row.id).run();}catch(e:any){if(data.messageId&&/^Telegram editMessageText: HTTP 400 · Bad Request: message is not modified/.test(String(e.message))){await db.prepare("UPDATE wa_outbox SET state='sent',provider_id=?,error=NULL WHERE id=?").bind(String(data.messageId),row.id).run();return;}const detail=String(e.message||'Entrega não confirmada.').replaceAll(env.TELEGRAM_BOT_TOKEN||'__none__','[segredo]').slice(0,240);console.error('telegram_delivery_failed',detail);await db.prepare("UPDATE wa_outbox SET state='needs_review',error=? WHERE id=?").bind(detail+' Entrega não confirmada; não reenviar automaticamente.',row.id).run();}}
async function processIncoming(env:Runtime,event:any){
 // The webhook already persisted this exact event. Avoid rereading the queue on the normal path.
 try{await processOne(env,event)}catch{await env.DB!.prepare("UPDATE wa_inbox SET state='queued',error='Falha transitória no processamento.' WHERE id=? AND state<>'done'").bind(event.id).run();}
 await processJobs(env,event.phone);
}
async function flushOutbox(env:Runtime,phone?:string){
 const out=await env.DB!.prepare("SELECT * FROM wa_outbox WHERE phone LIKE 'tg:%' AND state='queued'"+(phone?' AND phone=?':'')+' ORDER BY rowid LIMIT 10').bind(...(phone?[phone]:[])).all();
 for(const row of out.results)await sendOutbox(env,row);
}
export async function processJobs(env:Runtime,phone?:string){
 const db=env.DB!;
 const recover=db.prepare("UPDATE wa_outbox SET state='needs_review',error='Envio interrompido; entrega incerta, não reenviar automaticamente.' WHERE phone LIKE 'tg:%' AND state='sending' AND attempted<?").bind(new Date(Date.now()-120000).toISOString()).run();
 const next=()=>db.prepare("SELECT * FROM wa_inbox WHERE phone LIKE 'tg:%' AND (state='queued' OR (state='processing' AND expires<?))"+(phone?' AND phone=?':'')+' ORDER BY rowid LIMIT 1').bind(now(),...(phone?[phone]:[])).first<any>();
 const [,first]=await Promise.all([recover,next()]);
 // Replies are sent after each operation, before another document or maintenance task.
 for(let i=0;i<5;i++){
  const event=i===0?first:await next();
  if(!event)break;
  try{await processOne(env,event)}catch{await db.prepare("UPDATE wa_inbox SET state='queued',error='Falha transitória no processamento.' WHERE id=? AND state<>'done'").bind(event.id).run();}
  await flushOutbox(env,event.phone);
  // A prior pending reply may have blocked acquisition; the next iteration retries after delivery.
 }
 await flushOutbox(env,phone);
 // Clean old resources after interactive replies.
 await db.prepare('DELETE FROM wa_pairings WHERE expires<?').bind(now()).run();
 await purgeDeletedDocuments(env);
}
