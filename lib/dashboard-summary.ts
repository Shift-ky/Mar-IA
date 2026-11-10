import {walletBalances,walletNames,walletsForPanel} from './wallets';
import {recurringOccurrences} from './recurring';
import {buildAnalytics,previousMonth} from './analytics';
const cents=(v:any)=>Math.round(Number(v||0)*100);
const total=(rows:any[])=>rows.reduce((n,r)=>n+cents(r.amount),0)/100;
export function dashboardSummary(records:any[],month:string,today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'})){
 const [y,m]=month.split('-').map(Number),start=month+'-01',end=new Date(Date.UTC(y,m,0)).toISOString().slice(0,10),cutoff=today<end?today:end;
 const active=records.filter(r=>!r.voided),asOf=active.filter(r=>!r.date||r.date<=cutoff);
 const names=walletsForPanel(records),balances=walletBalances(asOf),balance=names.reduce((n,w)=>n+cents(balances[w]),0)/100;
 const confirmed=active.filter(r=>r.kind==='transaction'&&r.paid&&r.date>=start&&r.date<=cutoff);
 const expenses=confirmed.filter(r=>r.type==='expense'),income=confirmed.filter(r=>r.type==='income');
 const existing=new Set(active.map(r=>r.id)),skipped=new Set(active.filter(r=>r.kind==='recurringSkip').map(r=>r.transactionId));
 const scheduled=active.filter(r=>r.kind==='recurringBill').flatMap(rule=>recurringOccurrences(rule,end)).filter(row=>row.kind==='transaction'&&row.data.date>cutoff&&!existing.has(row.id)&&!skipped.has(row.id)).map(row=>({...row.data,id:row.id,kind:row.kind,paid:false}));
 const pending=[...active.filter(r=>r.kind==='transaction'&&(!r.paid||r.date>cutoff)&&r.date<=end),...scheduled];
 const incoming=pending.filter(r=>r.type==='income'),outgoing=pending.filter(r=>r.type==='expense');
 const expected=total(incoming),bills=total(outgoing),forecast=(cents(balance)+cents(expected)-cents(bills))/100;
 const priorKey=previousMonth(month),prior=active.filter(r=>r.kind==='transaction'&&r.type==='expense'&&r.paid&&r.date?.startsWith(priorKey));
 const priorExpenses=total(prior),paidExpenses=total(expenses),change=priorExpenses?(paidExpenses-priorExpenses)/priorExpenses*100:null;
 const categories=Object.entries(expenses.reduce((map:any,r:any)=>{const key=r.category||'Outros';map[key]=(map[key]||0)+cents(r.amount);return map},{})).map(([name,value])=>({name,value:Number(value)/100})).sort((a,b)=>b.value-a.value);
 const trend=Array.from({length:Number(end.slice(-2))},(_,i)=>{
 const date=month+'-'+String(i+1).padStart(2,'0');const pointBalances=walletBalances(active.filter(r=>!r.date||r.date<=date));
 const actual=date<=cutoff?names.reduce((n,w)=>n+cents(pointBalances[w]),0)/100:null;
 const projected=date===cutoff?balance:date>cutoff?(cents(balance)+incoming.filter(r=>r.date<=date).reduce((n,r)=>n+cents(r.amount),0)-outgoing.filter(r=>r.date<=date).reduce((n,r)=>n+cents(r.amount),0))/100:null;
 return {day:i+1,date,actual,projected};
 });
 const goals=buildAnalytics(asOf,month).goals;
 return {balances,balance,paidExpenses,received:total(income),expected,bills,forecast,categories,trend,goals,change,cutoff,end,hasData:active.some(r=>['transaction','walletMovement','walletTransfer'].includes(r.kind)),hasProjection:cutoff<end};
}
