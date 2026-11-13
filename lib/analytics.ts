import {goalProgress} from './goals';
const cents=(value:any)=>Math.round(Number(value||0)*100);
const monthKey=(year:number,month:number)=>`${year}-${String(month).padStart(2,'0')}`;

export function previousMonth(month:string){
 const [year,number]=month.split('-').map(Number);
 const date=new Date(Date.UTC(year,number-2,1));
 return monthKey(date.getUTCFullYear(),date.getUTCMonth()+1);
}

export function buildAnalytics(records:any[],month:string,rates:Record<string,{rate:number;date?:string}>={}){
 const transactions=(records||[]).filter(r=>r.kind==='transaction'&&!r.voided&&/^\d{4}-\d{2}-\d{2}$/.test(r.date||''));
 const current=transactions.filter(r=>r.date.startsWith(month));
 const priorMonth=previousMonth(month),prior=transactions.filter(r=>r.date.startsWith(priorMonth));
 const totals=(rows:any[])=>{
  const income=rows.filter(r=>r.type==='income').reduce((sum,r)=>sum+cents(r.amount),0);
  const expenses=rows.filter(r=>r.type==='expense').reduce((sum,r)=>sum+cents(r.amount),0);
  return {income,expenses,economy:income-expenses,purchases:rows.filter(r=>r.type==='expense').length,count:rows.length};
 };
 const now=totals(current),before=totals(prior);
 const categoryMap=new Map<string,number>();
 for(const row of current.filter(r=>r.type==='expense')){
  const category=String(row.category||'Sem categoria');
  categoryMap.set(category,(categoryMap.get(category)||0)+cents(row.amount));
 }
 const categories=[...categoryMap].map(([name,value])=>({name,value:value/100})).sort((a,b)=>b.value-a.value);
 const [year,number]=month.split('-').map(Number);
 const trend=Array.from({length:6},(_,index)=>{
  const date=new Date(Date.UTC(year,number-1-(5-index),1));
  const key=monthKey(date.getUTCFullYear(),date.getUTCMonth()+1);
  const value=transactions.filter(r=>r.date.startsWith(key)&&r.type==='expense').reduce((sum,r)=>sum+cents(r.amount),0);
  return {month:key,label:date.toLocaleDateString('pt-BR',{month:'short',timeZone:'UTC'}).replace('.',''),expenses:value/100};
 });
 const purchases=current.filter(r=>r.type==='expense').sort((a,b)=>b.date.localeCompare(a.date)||String(b.id).localeCompare(String(a.id))).slice(0,5);
 const purchaseItems=(records||[]).filter(r=>r.kind==='purchaseItem');
 const goals=(records||[]).filter(r=>r.kind==='goal').map(goal=>{
  const mode=goal.goalType||goal.mode||goal.type||'accumulation';
  if(['spendingLimit','expenseLimit','limit'].includes(mode)){
   const applicable=current.filter(r=>r.type==='expense'&&(!goal.category||r.category===goal.category));
   const spent=applicable.reduce((sum,r)=>sum+cents(r.amount),0);
   const target=cents(goal.amount);
   return {id:goal.id,name:goal.name,mode:'limit',amount:target/100,progress:spent/100,percent:target?Math.min(100,spent/target*100):0,remaining:Math.max(0,target-spent)/100,category:goal.category||null};
  }
  const progress=goalProgress(goal,records,rates),target=cents(goal.amount);
  return {id:goal.id,name:goal.name,mode:'accumulation',amount:target/100,progress:progress.accumulated,percent:progress.percent,remaining:progress.remaining,category:null};
 });
 const periodHasComparison=prior.length>0;
 return {current,prior,now:{income:now.income/100,expenses:now.expenses/100,economy:now.economy/100,purchases:now.purchases,count:now.count},before:{income:before.income/100,expenses:before.expenses/100,economy:before.economy/100,purchases:before.purchases,count:before.count},priorMonth,periodHasComparison,categories,trend,purchases,purchaseItems,goals};
}
