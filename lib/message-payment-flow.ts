import {paymentAnswer} from './payment-methods';
import {walletNames,walletDefinition} from './wallets';
import {digest} from './whatsapp/crypto';
import {money} from './whatsapp/commands';
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
export async function messagePaymentFlow({db,event,a,records,text,candidate,finish}:any):Promise<boolean>{
 const key='entry-payment:'+event.phone,row=await db.prepare('SELECT value FROM settings WHERE key=?').bind(key).first<any>();let session:any=null;try{if(row)session=JSON.parse(row.value)}catch{}
 if(!session&&!candidate)return false;
 const reply=(rows:any[],message:string,extra:any[]=[],permission='add')=>finish(rows,message,extra,permission),answer=normalize(String(text||''));
 if(!session){
  if(!a.permissions.add){await reply([],'Sem permissão para registrar receitas ou despesas.',[],'');return true;}
  const id=await digest(event.phone+':'+event.id);session={id,family:a.family,user:a.user,phone:event.phone,candidate:{...candidate},stage:'payment',expires:Date.now()+86400000};
  const title=candidate.type==='income'?'a receita':'a despesa';
  await reply([],'Qual foi a forma de pagamento de '+title+' “'+candidate.name+'” ('+money(Number(candidate.amount))+')? Responda Dinheiro, Vale-alimentação, Vale-refeição, Combustível ou Pix. Depois perguntarei a carteira.',[
   {sql:'INSERT INTO settings(key,value) SELECT ?,? WHERE $GUARD ON CONFLICT(key) DO UPDATE SET value=excluded.value',args:[key,JSON.stringify(session)]}
  ]);return true;
 }
 if(session.family!==a.family||session.user!==a.user||session.phone!==event.phone){await db.prepare('DELETE FROM settings WHERE key=?').bind(key).run();return false;}
 if(!Number.isFinite(session.expires)||session.expires<Date.now()){await db.prepare('DELETE FROM settings WHERE key=?').bind(key).run();await reply([],'A pergunta sobre a forma de pagamento expirou. Envie novamente o lançamento se ainda precisar registrá-lo.');return true;}
 const candidateData=session.candidate||{};
 if(/^(cancelar|cancelar lancamento)$/.test(answer)){await reply([],'Lançamento cancelado; nada foi registrado.',[{sql:'DELETE FROM settings WHERE key=? AND $GUARD',args:[key]}]);return true;}
 if(session.stage==='payment'){
  const method=paymentAnswer(String(text||''));if(!method){await reply([],'Não reconheci a forma de pagamento. Responda Dinheiro, Vale-alimentação, Vale-refeição, Combustível ou Pix. Envie CANCELAR para desistir.');return true;}
  const next={...session,candidate:{...candidateData,paymentMethod:method},stage:'wallet',expires:Date.now()+86400000},wallets=walletNames(records).filter((name:string)=>walletDefinition(records,name).currency==='BRL'&&walletDefinition(records,name).type!=='credito');
  await reply([],candidateData.type==='income'?'Em qual carteira entrou o dinheiro? Responda com uma destas: '+wallets.join(', ')+'.':'De qual carteira saiu o dinheiro? Responda com uma destas: '+wallets.join(', ')+'.',[{sql:'UPDATE settings SET value=? WHERE key=? AND $GUARD',args:[JSON.stringify(next),key]}]);return true;
 }
 if(session.stage==='wallet'){
  const wallets=walletNames(records).filter((name:string)=>walletDefinition(records,name).currency==='BRL'&&walletDefinition(records,name).type!=='credito'),wallet=wallets.find((name:string)=>normalize(name).replace(/[\s-]+/g,'')===answer.replace(/[\s-]+/g,''));if(!wallet){await reply([],'Não reconheci essa carteira. Responda com uma destas: '+wallets.join(', ')+'.');return true;}
  const next={...session,candidate:{...candidateData,wallet},stage:'confirm',expires:Date.now()+86400000},data=next.candidate;
  await reply([],(data.type==='income'?'Receita':'Despesa')+': '+money(Number(data.amount))+'\nDescrição: '+data.name+'\nData: '+String(data.date).split('-').reverse().join('/')+'\nForma de pagamento: '+data.paymentMethod+'\nCarteira: '+wallet+'\n\nResponda CONFIRMAR para registrar ou CANCELAR para desistir.',[{sql:'UPDATE settings SET value=? WHERE key=? AND $GUARD',args:[JSON.stringify(next),key]}]);return true;
 }
 if(session.stage==='confirm'){
  if(!/^(confirmar|confirmar lancamento)$/.test(answer)){await reply([],'Confira os dados e responda CONFIRMAR para registrar ou CANCELAR para desistir.');return true;}
  if(!a.permissions.add){await db.prepare('DELETE FROM settings WHERE key=?').bind(key).run();await reply([],'Sem permissão para registrar.',[],'');return true;}
  const data=candidateData,duplicate=records.some((r:any)=>r.kind==='transaction'&&r.date===data.date&&r.type===data.type&&Number(r.amount)===Number(data.amount)&&String(r.name||'').trim().toLowerCase()===String(data.name||'').trim().toLowerCase());
  if(duplicate){await reply([],'Há um lançamento semelhante. Para registrar esta movimentação, envie confirmar '+session.id+'. Para desistir, envie cancelar '+session.id+'.',[{sql:"INSERT OR IGNORE INTO wa_drafts SELECT ?,?,?,?,?,'pending',? WHERE $GUARD",args:[session.id,a.family,a.user,event.phone,JSON.stringify(data),new Date().toISOString()]},{sql:'DELETE FROM settings WHERE key=? AND $GUARD',args:[key]}]);return true;}
  const rowData={...data,source:event.phone.startsWith('tg:')?'telegram':'whatsapp',waMessageId:'payment-flow:'+session.id};await reply([{id:'wa-tx-'+session.id,kind:'transaction',data:rowData}],'Lançamento registrado: '+(data.type==='income'?'receita':'despesa')+' de '+money(Number(data.amount))+' · '+data.paymentMethod+' · carteira '+data.wallet+'.',[{sql:'DELETE FROM settings WHERE key=? AND $GUARD',args:[key]}]);return true;
 }
 await db.prepare('DELETE FROM settings WHERE key=?').bind(key).run();return false;
}
