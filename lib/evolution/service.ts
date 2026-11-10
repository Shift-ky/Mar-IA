import {actor} from '../whatsapp/access';
import {boundedBody,digest,verify} from '../whatsapp/crypto';
import {parseCommand,summary,money} from '../whatsapp/commands';
import {normalize,help} from './protocol';
import {storeDocument,purgeDocuments} from './documents';
import {financialReceipt} from '../telegram/financial-receipt';
import {paymentMethods,paymentAnswer} from '../payment-methods';
import {walletBalances,walletNames,walletDefinition} from '../wallets';
import {feiraList} from '../feira';
type Runtime=Cloudflare.Env;
const json=(v:any,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
const now=()=>new Date().toISOString();
export const ready=(env:Runtime)=>!!(env.DB&&env.EVOLUTION_BRIDGE_SECRET&&env.EVOLUTION_INSTANCE);
export async function envelope(req:Request,env:Runtime){
 if(req.method!=='POST')throw Error('Método inválido.');
 if(!ready(env))throw Error('WhatsApp ainda não configurado.');
 const body=await boundedBody(req,30000000);
 if(!await verify(env.EVOLUTION_BRIDGE_SECRET!,body,req.headers.get('x-mar-job-signature')))throw Error('Acesso negado.');
 const data=JSON.parse(body);if(!Number.isFinite(data.at)||Math.abs(Date.now()-data.at)>60000)throw Error('Solicitação expirada.');return data;
}
export async function identity(env:Runtime,sender:string,chat:string){
 const db=env.DB!,link=await db.prepare('SELECT * FROM ev_links WHERE sender=?').bind(sender).first<any>();
 if(!link)throw Error('Vincule seu WhatsApp na aba WhatsApp da Mar IA.');
 const a=await actor(db,link.user,link.email,link.family);
 if(chat!==sender){const group=await db.prepare('SELECT * FROM ev_groups WHERE chat=?').bind(chat).first<any>();if(!group||group.family!==a.family)throw Error('Grupo não vinculado à sua família.');}
 return {...a,sender,chat};
}
// Every commit rechecks membership, provider link and group scope in the same D1 batch.
function guard(a:any,permission=''){
 return {sql:`EXISTS (SELECT 1 FROM ev_links WHERE sender=? AND user=? AND family=?) AND EXISTS (SELECT 1 FROM members WHERE family=? AND email=? AND (role='admin' OR ?='' OR json_extract(permissions,?)=1)) AND EXISTS (SELECT 1 FROM profiles WHERE id=? AND email=?) AND EXISTS (SELECT 1 FROM families WHERE id=?) AND (?=? OR EXISTS (SELECT 1 FROM ev_groups WHERE chat=? AND family=?))`,args:[a.sender,a.user,a.family,a.family,a.email,permission,'$.'+(permission||'view'),a.user,a.email,a.family,a.chat,a.sender,a.chat,a.family]};
}
async function reply(db:D1Database,event:any,text:string,a:any=null,permission=''){
 const g=a?guard(a,permission):{sql:'1=1',args:[]};
 await db.batch([
 db.prepare(`INSERT OR IGNORE INTO ev_outbox(id,chat,body,context,state) SELECT ?,?,?,?,'queued' WHERE ${g.sql}`).bind('reply:'+event.id,event.chat,text,a?JSON.stringify({...a,permission}):null,...g.args),
 db.prepare("UPDATE ev_inbox SET state='done' WHERE id=?").bind(event.id)
 ]);
}
const normalizeAnswer=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
function confirmationSummary(receipt:any,wallet:string,group=false,includePaymentMethod=true){const prefix=group?'Maria, ':'';const paymentLine=includePaymentMethod?'\nForma de pagamento: '+receipt.paymentMethod:'';return (receipt.type==='income'?'Receita':'Despesa')+': '+money(receipt.total)+'\nDescrição: '+receipt.store+'\nData: '+receipt.date.split('-').reverse().join('/')+paymentLine+'\nCarteira: '+wallet+'\nSituação: '+(receipt.paid?'Pago / recebido':'Pendente')+'\n\nResponda '+prefix+'CONFIRMAR para registrar ou '+prefix+'CANCELAR para deixar o comprovante pendente.';}
async function receiptWallets(db:D1Database,family:string){const rows=await db.prepare("SELECT kind,data FROM records WHERE family=? AND kind IN ('wallet','walletDeleted')").bind(family).all<any>(),records=rows.results.map((row:any)=>({...JSON.parse(row.data),kind:row.kind}));return walletNames(records).filter(name=>walletDefinition(records,name).currency==='BRL');}
function balanceWalletNames(records:any[]){return walletNames(records).filter(name=>{const wallet=walletDefinition(records,name);return wallet.currency==='BRL'&&wallet.showInFeira===true;});}
function walletQuestion(type:string,names:string[],group=false){const prefix=group?'Maria, ':'';return `${type==='income'?'Em qual carteira entrou o dinheiro?':'De qual carteira saiu o dinheiro?'} Responda ${prefix}${names.join(', ')}.`;}
function balanceWalletOptions(names:string[]){return names.map((name,index)=>'( '+(index+1)+' ) '+name).join('\n');}
function balanceWalletPrompt(names:string[],group=false){const instruction=group?'No grupo, responda Maria, seguido do número (ex.: Maria, 1).':'Responda com o número da opção.';return 'Saldo de qual carteira deseja consultar?\n'+balanceWalletOptions(names)+'\n'+instruction+' Para cancelar, digite CANCELAR.';}
async function handleBalanceSession(env:Runtime,event:any,m:any,a:any,key:string,session:any){
 const db=env.DB!,raw=String(m.text||'').trim().replace(/^\s*maria\s*,\s*/i,''),answer=normalizeAnswer(raw);
 if(session.user!==a.user||session.family!==a.family||session.sender!==m.sender||session.chat!==m.chat)return false;
 if(!Number.isFinite(session.expires)||session.expires<Date.now()){await db.prepare('DELETE FROM settings WHERE key=?').bind(key).run();await reply(db,event,'A consulta de saldo expirou. Digite saldo para começar novamente.',a,'view');return true;}
 if(answer==='cancelar'){await db.prepare('DELETE FROM settings WHERE key=?').bind(key).run();await reply(db,event,'Consulta de saldo cancelada.',a,'view');return true;}
 const choices=Array.isArray(session.wallets)?session.wallets:[];if(!choices.length){await db.prepare('DELETE FROM settings WHERE key=?').bind(key).run();await reply(db,event,'Não há carteiras com uso na Feira ativado nesta família.',a,'view');return true;}
 if(answer==='saldo'){const next={...session,expires:Date.now()+600000};await db.prepare('UPDATE settings SET value=? WHERE key=?').bind(JSON.stringify(next),key).run();await reply(db,event,balanceWalletPrompt(choices,m.group),a,'view');return true;}
 const match=/^\(\s*(\d+)\s*\)$|^(\d+)$/.exec(raw),index=Number(match?.[1]||match?.[2]||0),wallet=choices[index-1];if(!wallet){await reply(db,event,'Opção inválida. Escolha um número da lista.\n'+balanceWalletPrompt(choices,m.group),a,'view');return true;}
 const rows=await db.prepare('SELECT * FROM records WHERE family=?').bind(a.family).all<any>(),records=rows.results.map((r:any)=>({...JSON.parse(r.data),id:r.id,kind:r.kind})),available=balanceWalletNames(records);
 if(!available.includes(wallet)){if(!available.length){await db.prepare('DELETE FROM settings WHERE key=?').bind(key).run();await reply(db,event,'Não há carteiras com uso na Feira ativado nesta família.',a,'view');return true;}const next={...session,wallets:available,expires:Date.now()+600000};await db.prepare('UPDATE settings SET value=? WHERE key=?').bind(JSON.stringify(next),key).run();await reply(db,event,'A configuração das carteiras mudou.\n'+balanceWalletPrompt(available,m.group),a,'view');return true;}
 const balance=walletBalances(records)[wallet]||0;await db.prepare('DELETE FROM settings WHERE key=?').bind(key).run();await reply(db,event,'Saldo da carteira '+wallet+': '+money(balance),a,'view');return true;
}
async function handleEntrySession(env:Runtime,event:any,m:any,a:any,key:string,session:any){
 const db=env.DB!,text=String(m.text||'').trim(),answer=normalizeAnswer(text),prefix=m.group?'Maria, ':'';
 if(session.user!==a.user||session.family!==a.family||session.sender!==m.sender||session.chat!==m.chat)return false;
 if(!Number.isFinite(session.expires)||session.expires<Date.now()){await db.prepare('DELETE FROM settings WHERE key=?').bind(key).run();await reply(db,event,'A pergunta sobre a carteira expirou. Envie o lançamento novamente.',a,'add');return true;}
 if(/^(cancelar|cancelar lancamento)$/.test(answer)){await db.prepare('DELETE FROM settings WHERE key=?').bind(key).run();await reply(db,event,'Lançamento cancelado; nada foi registrado.',a,'add');return true;}
 const candidate=session.candidate||{};
 if(session.stage==='payment'||session.stage==='wallet'){
  const wallets=await receiptWallets(db,a.family),wallet=wallets.find(name=>normalizeAnswer(name).replace(/[\s-]+/g,'')===answer.replace(/[\s-]+/g,''));if(!wallet){await reply(db,event,'Não reconheci essa carteira. '+walletQuestion(candidate.type,wallets,m.group),a,'add');return true;}
  const next={...session,candidate:{...candidate,wallet,paymentMethod:wallet},stage:'confirm',expires:Date.now()+86400000};await db.prepare('UPDATE settings SET value=? WHERE key=?').bind(JSON.stringify(next),key).run();
  const receipt={type:candidate.type,total:candidate.amount,store:candidate.name,date:candidate.date,paymentMethod:wallet,paid:candidate.paid!==false};await reply(db,event,confirmationSummary(receipt,wallet,m.group,false),a,'add');return true;
 }
 if(session.stage==='confirm'){
  if(!/^(confirmar|confirmar lancamento)$/.test(answer)){await reply(db,event,'Confira os dados e responda '+prefix+'CONFIRMAR para registrar ou '+prefix+'CANCELAR para desistir.',a,'add');return true;}
  if(!a.permissions.add){await db.prepare('DELETE FROM settings WHERE key=?').bind(key).run();await reply(db,event,'Sem permissão para registrar este lançamento.',a);return true;}
  const g=guard(a,'add'),recordId='ev-tx-'+session.id,record={...candidate,source:'whatsapp',provider:'evolution'};
  const result=await db.batch([
   db.prepare(`INSERT OR IGNORE INTO records(id,family,kind,data,author) SELECT ?,?,'transaction',?,? WHERE ${g.sql}`).bind(recordId,a.family,JSON.stringify(record),a.email,...g.args),
   db.prepare('DELETE FROM settings WHERE key=?').bind(key),
   db.prepare(`INSERT OR IGNORE INTO ev_outbox(id,chat,body,context,state) SELECT ?,?,?,?,'queued' WHERE EXISTS (SELECT 1 FROM records WHERE id=? AND family=?) AND ${g.sql}`).bind('reply:'+event.id,m.chat,'Lançamento registrado: '+record.name+' · '+money(Number(record.amount))+' · carteira '+record.wallet,JSON.stringify({...a,permission:'add'}),recordId,a.family,...g.args),
   db.prepare("UPDATE ev_inbox SET state='done' WHERE id=? AND EXISTS (SELECT 1 FROM records WHERE id=? AND family=?)").bind(event.id,recordId,a.family)
  ]);if(!result[3].meta.changes)throw Error('Conflito temporário de sincronização.');return true;
 }
 await db.prepare('DELETE FROM settings WHERE key=?').bind(key).run();return false;
}
async function handleReceiptSession(env:Runtime,event:any,m:any,a:any,key:string,session:any){
 const db=env.DB!,text=String(m.text||'').trim(),answer=normalizeAnswer(text);
 if(session.user!==a.user||session.family!==a.family||session.sender!==m.sender||session.chat!==m.chat)return false;
 if(!Number.isFinite(session.expires)||session.expires<Date.now()){
  await db.prepare('DELETE FROM settings WHERE key=?').bind(key).run();
  await reply(db,event,'A confirmação deste comprovante expirou. Reenvie o arquivo para iniciar novamente.',a,'add');return true;
 }
 if(/^(cancelar|cancelar comprovante)$/.test(answer)){
  await db.prepare('DELETE FROM settings WHERE key=? AND json_extract(value,\'$.documentId\')=?').bind(key,session.documentId).run();
  await reply(db,event,'Comprovante mantido na aba WhatsApp, sem registrar a movimentação.',a,'add');return true;
 }
 const doc=await db.prepare("SELECT * FROM ev_documents WHERE id=? AND family=? AND user=? AND state='needs_review'").bind(session.documentId,a.family,a.user).first<any>();
 if(!doc){await db.prepare('DELETE FROM settings WHERE key=?').bind(key).run();await reply(db,event,'Este comprovante não está mais pendente. Nenhuma nova movimentação foi criada.',a,'add');return true;}
 const data=JSON.parse(doc.data||'{}'),candidate=data.receipt||data.draft;
 if(session.stage==='payment'){
  const method=paymentAnswer(text);if(!method){await reply(db,event,'Não reconheci a forma de pagamento. Responda com '+(m.group?'Maria, ':'')+'Pix, Dinheiro, Vale-alimentação, Vale-refeição ou Combustível.',a,'add');return true;}
  let receipt:any;try{receipt=financialReceipt({...candidate,paymentMethod:method,paid:data.paid!==false},true)}catch{await db.prepare('DELETE FROM settings WHERE key=?').bind(key).run();await reply(db,event,'Os dados do comprovante precisam ser completados na aba WhatsApp do aplicativo antes da confirmação.',a,'add');return true;}
  const wallets=await receiptWallets(db,a.family),next={...session,stage:'wallet',paymentMethod:method,expires:Date.now()+86400000},updated={...data,draft:{...candidate,paymentMethod:method},paymentMethod:method,paid:receipt.paid,reason:'Informe a carteira e confira o resumo no WhatsApp antes de registrar.'};
  await db.batch([
   db.prepare("UPDATE ev_documents SET data=? WHERE id=? AND family=? AND user=? AND state='needs_review'").bind(JSON.stringify(updated),doc.id,a.family,a.user),
   db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,JSON.stringify(next))
  ]);
  await reply(db,event,walletQuestion(receipt.type,wallets,m.group),a,'add');return true;
 }
 if(session.stage==='wallet'){
  const wallets=await receiptWallets(db,a.family),wallet=wallets.find(name=>normalizeAnswer(name).replace(/[\s-]+/g,'')===answer.replace(/[\s-]+/g,''));if(!wallet){await reply(db,event,'Não reconheci essa carteira. '+walletQuestion(candidate?.type||'expense',wallets,m.group),a,'add');return true;}
  let receipt:any;try{receipt=financialReceipt({...candidate,paymentMethod:session.paymentMethod,paid:data.paid!==false},true)}catch{await db.prepare('DELETE FROM settings WHERE key=?').bind(key).run();await reply(db,event,'Os dados do comprovante precisam ser completados na aba WhatsApp do aplicativo antes da confirmação.',a,'add');return true;}
  const next={...session,stage:'confirm',wallet,expires:Date.now()+86400000},updated={...data,draft:{...candidate,paymentMethod:session.paymentMethod,wallet},paymentMethod:session.paymentMethod,wallet,paid:receipt.paid,reason:'Confira valor, forma de pagamento e carteira no WhatsApp antes de registrar.'};
  await db.batch([
   db.prepare("UPDATE ev_documents SET data=? WHERE id=? AND family=? AND user=? AND state='needs_review'").bind(JSON.stringify(updated),doc.id,a.family,a.user),
   db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,JSON.stringify(next))
  ]);
  await reply(db,event,confirmationSummary(receipt,wallet,m.group),a,'add');return true;
 }
 if(session.stage==='confirm'){
  if(!/^(confirmar|confirmar lancamento)$/.test(answer)){const prefix=m.group?'Maria, ':'';await reply(db,event,'Responda '+prefix+'CONFIRMAR para registrar com esses dados ou '+prefix+'CANCELAR para deixar o comprovante pendente.',a,'add');return true;}
 if(!a.permissions.add){await db.prepare('DELETE FROM settings WHERE key=?').bind(key).run();await reply(db,event,'Sem permissão para registrar este lançamento.',a);return true;}
  let receipt:any;try{receipt=financialReceipt({...candidate,paymentMethod:session.paymentMethod,paid:data.paid!==false},true)}catch{await db.prepare('DELETE FROM settings WHERE key=?').bind(key).run();await reply(db,event,'Os dados do comprovante precisam ser completados na aba WhatsApp do aplicativo.',a,'add');return true;}
  const g=guard(a,'add'),recordId='receipt-tx-'+doc.id,record={name:receipt.store,type:receipt.type,amount:receipt.total,date:receipt.date,paid:receipt.paid,category:'Outros',paymentMethod:receipt.paymentMethod,wallet:session.wallet,receiptId:doc.id,source:'whatsapp',provider:'evolution'},saved={receipt:{...receipt,wallet:session.wallet},wallet:session.wallet,reason:'Conferido e registrado pelo WhatsApp.'},message='Comprovante registrado: '+(receipt.type==='income'?'Receita':'Despesa')+' de '+money(receipt.total)+' em '+receipt.date.split('-').reverse().join('/')+' · '+(receipt.paid?'pago':'pendente')+' via '+receipt.paymentMethod+' · carteira '+session.wallet+'.';
  const result=await db.batch([
   db.prepare(`INSERT OR IGNORE INTO records(id,family,kind,data,author) SELECT ?,?,'transaction',?,? WHERE EXISTS (SELECT 1 FROM ev_documents WHERE id=? AND family=? AND state='needs_review') AND ${g.sql}`).bind(recordId,a.family,JSON.stringify(record),a.email,doc.id,a.family,...g.args),
   db.prepare("UPDATE ev_documents SET state='posted',data=? WHERE id=? AND family=? AND user=? AND state='needs_review' AND EXISTS (SELECT 1 FROM records WHERE id=? AND family=?)").bind(JSON.stringify(saved),doc.id,a.family,a.user,recordId,a.family),
   db.prepare('DELETE FROM settings WHERE key=? AND json_extract(value,\'$.documentId\')=?').bind(key,doc.id),
   db.prepare(`INSERT OR IGNORE INTO ev_outbox(id,chat,body,context,state) SELECT ?,?,?,?,'queued' WHERE EXISTS (SELECT 1 FROM ev_documents WHERE id=? AND family=? AND state='posted') AND ${g.sql}`).bind('reply:'+event.id,m.chat,message,JSON.stringify({...a,permission:'add'}),doc.id,a.family,...g.args),
   db.prepare("UPDATE ev_inbox SET state='done' WHERE id=? AND EXISTS (SELECT 1 FROM ev_documents WHERE id=? AND family=? AND state='posted')").bind(event.id,doc.id,a.family)
  ]);
  if(!result[4].meta.changes)throw Error('Conflito temporário de sincronização.');return true;
 }
 await db.prepare('DELETE FROM settings WHERE key=?').bind(key).run();return false;
}
async function processOne(env:Runtime,event:any){
 const db=env.DB!,m=JSON.parse(event.payload);
 try{
 const pairing=m.text.match(/^vincular\s+([a-f0-9]{48})$/i);
 if(pairing){
 const hash=await digest('evolution:'+pairing[1].toLowerCase()),p=await db.prepare('SELECT * FROM ev_pairings WHERE hash=? AND expires>?').bind(hash,now()).first<any>();
 if(!p||p.kind!==(m.group?'group':'person'))throw Error('Código inválido ou expirado. Gere outro no aplicativo.');
 const a=await actor(db,p.user,p.email,p.family);
 if(m.group){const sender=await identity(env,m.sender,m.sender);if(!a.admin||sender.user!==a.user||sender.family!==a.family)throw Error('O administrador deve vincular seu número em conversa privada primeiro.');}
 const existing=await db.prepare(`SELECT * FROM ${m.group?'ev_groups':'ev_links'} WHERE ${m.group?'chat':'sender'}=?`).bind(m.group?m.chat:m.sender).first<any>();
 if(existing&&(existing.family!==a.family||existing.user!==a.user))throw Error('Desvincule a conexão anterior no aplicativo primeiro.');
 const token=crypto.randomUUID();
 await db.batch([
 db.prepare("UPDATE ev_pairings SET expires=? WHERE hash=? AND expires>? AND EXISTS (SELECT 1 FROM members WHERE family=? AND email=? AND (?='person' OR role='admin'))").bind(token,hash,now(),a.family,a.email,p.kind),
 db.prepare(`INSERT INTO ${m.group?'ev_groups(chat,family,user,email)':'ev_links(sender,family,user,email)'} SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM ev_pairings WHERE hash=? AND expires=?) ON CONFLICT(${m.group?'chat':'sender'}) DO NOTHING`).bind(m.group?m.chat:m.sender,a.family,a.user,a.email,hash,token),
 db.prepare("INSERT OR IGNORE INTO ev_outbox(id,chat,body,context,state) SELECT ?,?,?,?,'queued' WHERE EXISTS (SELECT 1 FROM ev_pairings WHERE hash=? AND expires=?)").bind('reply:'+event.id,m.chat,'WhatsApp vinculado à família '+a.familyName+'. Envie '+(m.group?'Maria, saldo':'saldo')+'.',JSON.stringify({...a,sender:m.sender,chat:m.chat,permission:''}),hash,token),
 db.prepare('DELETE FROM ev_pairings WHERE hash=? AND expires=?').bind(hash,token),
 db.prepare("UPDATE ev_inbox SET state='done' WHERE id=?").bind(event.id)
 ]);return;
 }
 const a=await identity(env,m.sender,m.chat),context=event.context?JSON.parse(event.context):null;
 if(!context||context.user!==a.user||context.family!==a.family)throw Error('Vínculo alterado. Envie novamente a mensagem.');
 if(m.media){
  if(!m.documentId){await reply(db,event,'Não consegui receber este arquivo. Envie JPEG, PNG ou PDF de até 20 MB. Áudios ainda não são interpretados.',a);return;}
  const doc=await db.prepare('SELECT * FROM ev_documents WHERE id=? AND family=?').bind(m.documentId,a.family).first<any>();
  if(!doc){await reply(db,event,'O arquivo foi recebido, mas não consegui preparar a conferência. Veja a aba WhatsApp da Mar IA.',a,'add');return;}
  if(doc.state==='posted'){await reply(db,event,'Este comprovante já foi registrado. Nenhuma movimentação foi duplicada.',a,'add');return;}
  if(doc.user!==a.user){await reply(db,event,'Este comprovante já foi recebido nesta família. Confira na aba WhatsApp da Mar IA.',a,'add');return;}
  const key='ev:receipt:'+await digest(a.family+':'+m.sender+':'+m.chat),existing=await db.prepare('SELECT value FROM settings WHERE key=?').bind(key).first<any>(),current=existing?JSON.parse(existing.value):null;
  if(current&&current.expires>Date.now()){await reply(db,event,'Há outro comprovante aguardando confirmação neste chat. Responda '+(m.group?'Maria, ':'')+'CANCELAR ou conclua a confirmação anterior primeiro.',a,'add');return;}
  const data=JSON.parse(doc.data||'{}'),candidate=data.receipt||data.draft;
  if(!candidate||!Number.isFinite(Number(candidate.total))||!candidate.date||!['income','expense'].includes(candidate.type)){await reply(db,event,'O comprovante foi salvo em Pendências, mas não consegui identificar valor e data com segurança. Complete os dados na aba WhatsApp da Mar IA.',a,'add');return;}
  try{financialReceipt({...candidate,paid:data.paid!==false})}catch{await reply(db,event,'O comprovante foi salvo em Pendências, mas os dados precisam ser completados na aba WhatsApp da Mar IA.',a,'add');return;}
  const session={documentId:doc.id,family:a.family,user:a.user,sender:m.sender,chat:m.chat,stage:'payment',paymentMethod:null,expires:Date.now()+86400000};
  await db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,JSON.stringify(session)).run();
  await reply(db,event,'Comprovante recebido.\nIdentifiquei '+(candidate.type==='income'?'receita':'despesa')+' de '+money(Number(candidate.total))+' em '+String(candidate.date).split('-').reverse().join('/')+'.\nQual foi a forma de pagamento? Responda '+(m.group?'Maria, ':'')+'Pix, Dinheiro, Vale-alimentação, Vale-refeição ou Combustível. Depois perguntarei a carteira usada e enviarei o resumo para confirmar.',a,'add');return;
 }
 const receiptKey='ev:receipt:'+await digest(a.family+':'+m.sender+':'+m.chat),active=await db.prepare('SELECT value FROM settings WHERE key=?').bind(receiptKey).first<any>();if(active){let session:any;try{session=JSON.parse(active.value)}catch{session=null}if(session&&await handleReceiptSession(env,event,m,a,receiptKey,session))return;}
 const entryKey='ev:entry-payment:'+await digest(a.family+':'+m.sender+':'+m.chat),entryFlow=await db.prepare('SELECT value FROM settings WHERE key=?').bind(entryKey).first<any>();if(entryFlow){let session:any;try{session=JSON.parse(entryFlow.value)}catch{session=null}if(session&&await handleEntrySession(env,event,m,a,entryKey,session))return;}
 const balanceKey='ev:balance-choice:'+await digest(a.family+':'+m.sender+':'+m.chat),balanceFlow=await db.prepare('SELECT value FROM settings WHERE key=?').bind(balanceKey).first<any>();
 if(balanceFlow){let balanceSession:any;try{balanceSession=JSON.parse(balanceFlow.value)}catch{balanceSession=null}if(balanceSession&&await handleBalanceSession(env,event,m,a,balanceKey,balanceSession))return;}
 const command=parseCommand(m.text);
 if(command.action==='transaction'){
  if(!a.permissions.add)throw Error('Sem permissão para adicionar lançamentos.');
  const key='ev:entry-payment:'+await digest(a.family+':'+m.sender+':'+m.chat),wallets=await receiptWallets(db,a.family),session={id:await digest(event.id),family:a.family,user:a.user,sender:m.sender,chat:m.chat,candidate:{...command.data},stage:'wallet',expires:Date.now()+86400000};
  await db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,JSON.stringify(session)).run();
  await reply(db,event,'Para registrar '+(command.data.type==='income'?'a receita':'a despesa')+' “'+command.data.name+'” de '+money(Number(command.data.amount))+'. '+walletQuestion(command.data.type,wallets,m.group)+' Envie CANCELAR para desistir.',a,'add');return;
 }
 if(command.action==='balance'){
  if(!a.permissions.view)throw Error('Sem permissão para consultar registros.');
  const rows=await db.prepare('SELECT * FROM records WHERE family=?').bind(a.family).all<any>(),records=rows.results.map((r:any)=>({...JSON.parse(r.data),id:r.id,kind:r.kind})),wallets=balanceWalletNames(records);
  if(!wallets.length){await reply(db,event,'Não há carteiras com uso na Feira ativado nesta família.',a,'view');return;}
  const key='ev:balance-choice:'+await digest(a.family+':'+m.sender+':'+m.chat),session={user:a.user,family:a.family,sender:m.sender,chat:m.chat,wallets,expires:Date.now()+600000};
  await db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,JSON.stringify(session)).run();
  await reply(db,event,balanceWalletPrompt(wallets,m.group),a,'view');return;
 }
 if(command.action==='feira'){
  if(!a.permissions.view)throw Error('Sem permissão para consultar a lista da Feira.');
  const rows=await db.prepare('SELECT * FROM records WHERE family=?').bind(a.family).all<any>(),records=rows.results.map((r:any)=>({...JSON.parse(r.data),id:r.id,kind:r.kind})),items=feiraList(records).filter((item:any)=>!item.bought);
  const text=items.length?'Lista da Feira\n'+items.map((item:any,index:number)=>`${index+1}. ${item.name} — ${Number(item.quantity).toLocaleString('pt-BR',{maximumFractionDigits:3})} ${item.unit}`).join('\n'):'A lista da Feira está vazia. Cadastre itens avulsos ou confira os produtos do Estoque.';
  await reply(db,event,text,a,'view');return;
 }
 if(['report','movements'].includes(command.action)){
  if(!a.permissions.view)throw Error('Sem permissão para consultar registros.');
  const rows=await db.prepare('SELECT * FROM records WHERE family=?').bind(a.family).all<any>(),records=rows.results.map((r:any)=>({...JSON.parse(r.data),id:r.id,kind:r.kind}));
  const text=command.action==='movements'?records.filter((r:any)=>r.kind==='transaction').sort((x:any,y:any)=>y.date.localeCompare(x.date)).slice(0,10).map((r:any)=>r.date+' · '+r.name+' · '+money(r.amount)).join('\n')||'Nenhuma movimentação.':summary(records,command.month);
  await reply(db,event,'Família: '+a.familyName+'\n'+text,a,'view');return;
 }
 await reply(db,event,help,a);
 }catch(e:any){if(/Conflito temporário/.test(e.message)){await db.prepare('UPDATE ev_inbox SET error=? WHERE id=?').bind('Conflito; nova tentativa no próximo ciclo.',event.id).run();return;}await reply(db,event,e.message?.startsWith('Sem permissão')?e.message:'Não foi possível atender. Confira seu vínculo e suas permissões na aba WhatsApp.');}
}
export async function processIncoming(env:Runtime){const rows=await env.DB!.prepare("SELECT * FROM ev_inbox WHERE state='queued' ORDER BY created LIMIT 10").all<any>();for(const row of rows.results)await processOne(env,row);}
export async function webhook(req:Request,env:Runtime){
 let b:any;try{b=await envelope(req,env)}catch{return json({error:'Solicitação recusada.'},401)}
 const m=normalize(b.event,env.EVOLUTION_INSTANCE!);if(!m)return json({received:true,ignored:true});
 let context=null;try{const a=await identity(env,m.sender,m.chat);context=JSON.stringify({family:a.family,user:a.user})}catch{}
 if(m.media&&b.attachment&&context){try{(m as any).documentId=await storeDocument(env,await identity(env,m.sender,m.chat),b.attachment)}catch{}}
 await env.DB!.prepare("INSERT OR IGNORE INTO ev_inbox(id,sender,chat,payload,context,state,created) VALUES(?,?,?,?,?,'queued',?)").bind(m.key,m.sender,m.chat,JSON.stringify(m),context,now()).run();
 await processIncoming(env);return json({received:true});
}
export async function bridge(req:Request,env:Runtime){
 let b:any;try{b=await envelope(req,env)}catch{return json({error:'Solicitação recusada.'},401)}
 const db=env.DB!;
 if(b.action==='ack'){
 if(typeof b.id!=='string'||typeof b.lease!=='string'||!['sent','needs_review'].includes(b.state))return json({error:'Inválido.'},400);
 await db.prepare("UPDATE ev_outbox SET state=?,provider_id=?,error=? WHERE id=? AND lease=? AND state='sending'").bind(b.state,typeof b.providerId==='string'?b.providerId.slice(0,200):null,b.state==='needs_review'?'Entrega incerta. Verifique no WhatsApp antes de qualquer novo envio.':null,b.id,b.lease).run();return json({ok:true});
 }
 if(b.action!=='poll')return json({error:'Inválido.'},400);
 await purgeDocuments(env);
 await db.prepare("INSERT INTO settings(key,value) VALUES('ev:last-seen',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(now()).run();
 await db.prepare("UPDATE ev_outbox SET state='needs_review',error='Envio interrompido; confirmação ausente.' WHERE state='sending' AND attempted<?").bind(new Date(Date.now()-300000).toISOString()).run();
 await processIncoming(env);
 const rows=await db.prepare("SELECT * FROM ev_outbox WHERE state='queued' LIMIT 10").all<any>(),messages=[];
 for(const row of rows.results){if(row.context){const a=JSON.parse(row.context);try{const current=await identity(env,a.sender,a.chat);if(current.user!==a.user||current.family!==a.family||a.permission&&!current.permissions[a.permission])throw Error();}catch{await db.prepare("UPDATE ev_outbox SET state='blocked' WHERE id=? AND state='queued'").bind(row.id).run();continue;}}
 const lease=crypto.randomUUID(),r=await db.prepare("UPDATE ev_outbox SET state='sending',lease=?,attempted=? WHERE id=? AND state='queued'").bind(lease,now(),row.id).run();if(r.meta.changes)messages.push({id:row.id,lease,chat:row.chat,text:row.body});}
 return json({messages});
}
