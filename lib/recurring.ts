import {canUseWallet,walletDefinition,walletNames} from './wallets';

export function recurringWallets(records:any[],type:string) {
 return walletNames(records).filter(name=>{
  if(canUseWallet(records,name,'recurring'))return true;
  if(type!=='income')return false;
  const wallet=walletDefinition(records,name);
  return wallet.type==='beneficio'&&wallet.currency==='BRL';
 });
}

const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'});
function validDate(value:any){return typeof value==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(value)&&!isNaN(Date.parse(value))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;}
export function validateRecurring(raw:any,records:any[]=[]){const name=String(raw?.name||'').trim(),amount=Number(raw?.amount);if(!name||name.length>120||!Number.isFinite(amount)||amount<=0||amount>1e9||Math.abs(amount*100-Math.round(amount*100))>.00001)throw Error('Informe descrição e valor positivo com até duas casas decimais.');if(!['income','expense','transfer'].includes(raw.type)||!validDate(raw.startDate)||raw.endDate!==null&&(!validDate(raw.endDate)||raw.endDate<raw.startDate))throw Error('Confira o tipo e as datas de início e fim.');const paymentMethod=raw.type==='transfer'?undefined:String(raw.paymentMethod||'Dinheiro');if(raw.type!=='transfer'&&!recurringWallets(records,raw.type).includes(paymentMethod!))throw Error('Escolha uma carteira habilitada para contas fixas.');const category=String(raw.category||(raw.type==='expense'?'Contas fixas':'Receita fixa')).trim();if(!category||category.length>100)throw Error('Informe uma categoria de até 100 caracteres.');return {name,amount,...(raw.type!=='transfer'?{category}:{}),...(paymentMethod?{paymentMethod}:{}),type:raw.type,startDate:raw.startDate,endDate:raw.endDate,autoReceive:raw.type==='income'&&raw.autoReceive===true,...(raw.type==='transfer'?{fromWallet:'Dinheiro',toWallet:'Combustível'}:{})};}
export function recurringOccurrences(rule:any,reference=today()){
 if(rule.disabled)return [];
 const [year,month,day]=rule.startDate.split('-').map(Number);const end=rule.endDate&&rule.endDate<reference?rule.endDate:reference;const rows:any[]=[];
 for(let i=0;i<600;i++){const last=new Date(Date.UTC(year,month+i,0)).getUTCDate(),date=new Date(Date.UTC(year,month-1+i,Math.min(day,last))).toISOString().slice(0,10);if(date>end)break;rows.push({id:'recurring-'+rule.id+'-'+date,kind:rule.type==='transfer'?'walletTransfer':'transaction',family:rule.family,author:rule.author,data:{...(rule.type!=='transfer'&&rule.paymentMethod?{paymentMethod:rule.paymentMethod}:{}),...(rule.type==='transfer'?{fromWallet:'Dinheiro',toWallet:'Combustível'}:{}),name:rule.name,amount:rule.amount,type:rule.type,date,paid:rule.autoReceive===true&&date<=reference,category:rule.category||(rule.type==='expense'?'Contas fixas':'Receita fixa'),recurringId:rule.id,recurringManual:false,autoReceive:rule.autoReceive===true,source:'recurring'}});}
 return rows;
}
export function futureAutomaticRecurring(r:any,reference=today()){return ['transaction','walletTransfer'].includes(r.kind)&&!!r.recurringId&&r.source==='recurring'&&!r.paid&&!r.recurringManual&&r.date>reference;}
export function mergeRecurring(records:any[],reference=today()){
 const skipped=new Set(records.filter(r=>r.kind==='recurringSkip').map(r=>r.transactionId));const result=records.filter(r=>!futureAutomaticRecurring(r,reference)).map(r=>({...r})),ids=new Map(result.map((r,i)=>[r.id,i]));
 for(const rule of records.filter(r=>r.kind==='recurringBill'))for(const row of recurringOccurrences(rule,reference)){if(skipped.has(row.id))continue;const index=ids.get(row.id);if(index===undefined){ids.set(row.id,result.length);result.push({...row.data,id:row.id,kind:row.kind,family:row.family,author:row.author,local:rule.local===true});}else if(rule.autoReceive&&row.data.date<=reference&&!result[index].paid&&!result[index].recurringManual)result[index]={...result[index],paid:true};}
 return result;
}
export async function ensureRecurring(db:any,family:string,source?:any[]){
 const raw=source??(await db.prepare('SELECT * FROM records WHERE family=?').bind(family).all()).results.map((r:any)=>({...JSON.parse(r.data),id:r.id,kind:r.kind,family:r.family,author:r.author}));
 const reference=today();
 const statements:any[]=[];
 for(const r of raw.filter((r:any)=>futureAutomaticRecurring(r,reference)))statements.push(db.prepare("DELETE FROM records WHERE id=? AND family=? AND kind IN ('transaction','walletTransfer') AND data=?").bind(r.id,family,JSON.stringify(Object.fromEntries(Object.entries(r).filter(([key])=>!['id','family','kind','author'].includes(key))))));
 const skipped=new Set(raw.filter((r:any)=>r.kind==='recurringSkip').map((r:any)=>r.transactionId));
 for(const rule of raw.filter((r:any)=>r.kind==='recurringBill')){
  const persisted=await db.prepare("SELECT data FROM records WHERE id=? AND family=? AND kind='recurringBill'").bind(rule.id,family).first();
  if(!persisted)continue;
  const stored=persisted.data;
  const guard="EXISTS (SELECT 1 FROM records WHERE id=? AND family=? AND kind='recurringBill' AND data=?)";
  for(const row of recurringOccurrences(rule)){if(skipped.has(row.id))continue;const old=raw.find((r:any)=>r.id===row.id);if(!old)statements.push(db.prepare('INSERT OR IGNORE INTO records SELECT ?,?,?,?,? WHERE '+guard).bind(row.id,family,row.kind,JSON.stringify(row.data),rule.author,rule.id,family,stored));else if(rule.autoReceive&&row.data.paid&&!old.paid&&!old.recurringManual)statements.push(db.prepare("UPDATE records SET data=json_set(data,'$.paid',json('true')) WHERE id=? AND family=? AND json_extract(data,'$.paid')=0 AND coalesce(json_extract(data,'$.recurringManual'),0)=0 AND "+guard).bind(row.id,family,rule.id,family,stored));}
 }
 for(let i=0;i<statements.length;i+=40)await db.batch(statements.slice(i,i+40));
 return statements.length>0;
}
