import {walletNames,walletBalances,walletDefinition} from './wallets';
const cents=(v:any)=>Math.round(Number(v||0)*100);
const sum=(rows:any[])=>rows.reduce((n,r)=>n+cents(r.amount),0);
export const goalToday=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'});
function value(v:any,positive=false){const n=Number(v);if(v===''||v===null||!Number.isFinite(n)||n<0||(positive&&n===0)||n>1e9||Math.abs(n*100-Math.round(n*100))>0.00001)throw Error('Informe um valor válido em reais, com até duas casas decimais.');return n;}
function date(v:any){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||isNaN(Date.parse(v))||new Date(v+'T12:00:00Z').toISOString().slice(0,10)!==v)throw Error('Data inválida.');return v;}
export function validateGoal(d:any,records?:any[]){const name=String(d?.name||'').trim();if(!name||name.length>120)throw Error('Informe o nome da meta.');const wallets=d.wallets===undefined?undefined:Array.isArray(d.wallets)?[...new Set(d.wallets.map((w:any)=>String(w)))]:null;if(wallets===null||wallets&&(!wallets.length||wallets.length>3||wallets.some(w=>!w||w.length>60||records&&!walletNames(records).includes(w))))throw Error('Selecione de uma a três carteiras disponíveis para a meta.');const deadline=d.deadline?date(d.deadline):null;return {name,amount:value(d.amount,true),saved:value(d.saved??0),deadline,...(wallets?{wallets}:{}),...(typeof d.sourcePocketWalletId==='string'?{sourcePocketWalletId:d.sourcePocketWalletId}:{}),...(typeof d.sourcePocketWalletName==='string'?{sourcePocketWalletName:d.sourcePocketWalletName}:{})};}
export function validateContribution(d:any,records:any[],old?:any){const goal=records.find(r=>r.id===d?.goalId&&r.kind==='goal');if(!goal)throw Error('A meta não existe nesta família. Atualize a lista.');if(old&&old.goalId!==goal.id)throw Error('O aporte não pode ser transferido para outra meta.');const when=date(d.date);if(when>goalToday())throw Error('Um aporte deve ter data de hoje ou anterior.');return {name:String(d.name||'Aporte').trim().slice(0,120)||'Aporte',goalId:goal.id,amount:value(d.amount,true),date:when};}
export function validateSavingsPlan(d:any){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(d?.month||''))throw Error('Mês inválido.');return {name:'Planejamento mensal',month:d.month,spendingReserve:value(d.spendingReserve),extraExpenses:d.extraExpenses===null?null:value(d.extraExpenses)};}
export function goalProgress(goal:any,records:any[],rates:Record<string,{rate:number;date?:string}>={}){const contributions=records.filter(r=>r.kind==='goalContribution'&&r.goalId===goal.id),tracked=cents(goal.saved)+sum(contributions),balances=walletBalances(records),names=(goal.wallets||[goal.sourcePocketWalletName]).filter((name:string)=>name&&walletNames(records).includes(name)),byCurrency=new Map<string,{currency:string;amount:number;converted:number;rateDate?:string;missing:boolean}>();for(const name of names){const currency=walletDefinition(records,name).currency,amount=Math.max(0,Number(balances[name]||0)),quote=currency==='BRL'?{rate:1}:rates[currency],line=byCurrency.get(currency)||{currency,amount:0,converted:0,rateDate:quote?.date,missing:!quote};line.amount+=amount;if(quote&&Number.isFinite(quote.rate)&&quote.rate>0){line.converted+=amount*quote.rate;line.rateDate=quote.date||line.rateDate;line.missing=false;}else line.missing=true;byCurrency.set(currency,line);}const walletTotals=[...byCurrency.values()],walletValue=cents(walletTotals.reduce((n,line)=>n+line.converted,0)),accumulated=Math.max(tracked,walletValue),target=cents(goal.amount),remaining=Math.max(0,target-accumulated),percent=target>0?Math.min(100,accumulated/target*100):0;return {contributions,accumulated:accumulated/100,tracked:tracked/100,walletValue:walletValue/100,walletTotals,missingCurrencies:walletTotals.filter(line=>line.missing).map(line=>line.currency),remaining:remaining/100,percent,remainingPercent:target>0?Math.max(0,remaining/target*100):0};}
export function savingsForecast(records:any[],month:string,today=goalToday()){
 const start=month+'-01',[year,m]=month.split('-').map(Number);const end=new Date(Date.UTC(year,m,0)).toISOString().slice(0,10),cutoff=today<start?start:today>end?end:today;
 const tx=records.filter(r=>r.kind==='transaction'&&r.date&&Number.isFinite(Number(r.amount))),income=tx.filter(r=>r.type==='income'),expense=tx.filter(r=>r.type==='expense');
 const goalIds=new Set(records.filter(r=>r.kind==='goal').map(r=>r.id));const deposits=records.filter(r=>r.kind==='goalContribution'&&goalIds.has(r.goalId));
 const legacy=records.filter(r=>r.kind==='goal').reduce((n,r)=>n+cents(r.saved),0);
 const paidIncome=sum(income.filter(r=>r.paid&&r.date<=cutoff)),paidExpense=sum(expense.filter(r=>r.paid&&r.date<=cutoff)),reserved=legacy+sum(deposits.filter(r=>r.date<=cutoff));
 const cash=paidIncome-paidExpense-reserved;
 const received=sum(income.filter(r=>r.date>=start&&r.date<=cutoff&&r.paid));
 const upcomingIncome=sum(income.filter(r=>r.date>=start&&r.date<=end&&(!r.paid||r.date>cutoff)));
 const paidThisMonth=sum(expense.filter(r=>r.date>=start&&r.date<=cutoff&&r.paid));
 const bills=sum(expense.filter(r=>r.date>=start&&r.date<=end&&!r.paid));
 const forecastIncome=sum(income.filter(r=>r.date>=start&&r.date<=end));
 const forecastPaidExpenses=sum(expense.filter(r=>r.date>=start&&r.date<=end&&r.paid));
 const openBills=sum(expense.filter(r=>r.date<=end&&!r.paid));
 const forecastExpenses=forecastPaidExpenses+openBills;
 const forecastSavings=(forecastIncome-forecastExpenses)/100;
 const plan=records.find(r=>r.kind==='savingsPlan'&&r.month===month);
 // Pending expenses already entered in Contas a pagar are the source of the
 // remaining-spend estimate. Legacy extraExpenses values are intentionally
 // ignored to avoid counting a second, manually entered estimate.
 const extra=bills;
 const buffer=plan?cents(plan.spendingReserve):null;
 const ready=!!plan&&month===today.slice(0,7);
 const leftover=ready?cash-bills-buffer!:null;
 return {received:received/100,upcomingIncome:upcomingIncome/100,paidExpenses:paidThisMonth/100,bills:bills/100,forecastIncome:forecastIncome/100,forecastPaidExpenses:forecastPaidExpenses/100,openBills:openBills/100,forecastExpenses:forecastExpenses/100,forecastSavings,cash:cash/100,reserved:reserved/100,monthDeposits:sum(deposits.filter(r=>r.date>=start&&r.date<=end))/100,average:null,estimatedExtra:null,extra:extra/100,buffer:buffer===null?null:buffer/100,ready,availableNow:leftover===null?null:Math.max(0,leftover)/100,projected:leftover===null?null:(leftover+upcomingIncome)/100,shortfall:leftover===null?null:Math.max(0,-leftover)/100,plan,hasIncome:forecastIncome>0,past:month<today.slice(0,7),future:month>today.slice(0,7)};
}
