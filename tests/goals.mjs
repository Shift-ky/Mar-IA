import {build} from '../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild/lib/main.js';
import assert from 'node:assert/strict';
await build({entryPoints:['lib/goals.ts'],bundle:true,platform:'node',format:'esm',outfile:'work/goals-test.mjs'});
const {goalProgress,savingsForecast,validateGoal,validateContribution,validateSavingsPlan}=await import('../work/goals-test.mjs');
const goal={id:'goal-1',kind:'goal',name:'Minha conquista',amount:2500,saved:0};
let rows=[goal,{id:'deposit-1',kind:'goalContribution',goalId:goal.id,name:'Aporte',amount:50,date:'2026-10-01'}];
let progress=goalProgress(goal,rows);assert.equal(progress.accumulated,50);assert.equal(progress.remaining,2450);assert.equal(progress.percent,2);assert.equal(progress.remainingPercent,98);
assert.equal(goalProgress({...goal,saved:25},rows).accumulated,75);assert.equal(goalProgress({...goal,amount:10},rows).remaining,0);assert.equal(goalProgress({...goal,amount:10},rows).percent,100);
assert.throws(()=>validateGoal({name:'x',amount:-1}));assert.throws(()=>validateGoal({name:'x',amount:100,saved:-1}));assert.throws(()=>validateContribution({goalId:'another-family',amount:50,date:'2026-01-01'},rows));assert.throws(()=>validateContribution({goalId:goal.id,amount:0,date:'2026-01-01'},rows));assert.throws(()=>validateContribution({goalId:goal.id,amount:50,date:'2026-02-30'},rows));
assert.throws(()=>validateSavingsPlan({month:'2026-13',spendingReserve:10,extraExpenses:0}));
rows.push({kind:'transaction',name:'Salário',type:'income',paid:true,amount:1000,date:'2026-10-01'},{kind:'transaction',name:'Gastos pagos',type:'expense',paid:true,amount:300,date:'2026-10-05'},{kind:'transaction',name:'Conta pendente',type:'expense',paid:false,amount:200,date:'2026-10-25'},{kind:'transaction',name:'Receita esperada',type:'income',paid:false,amount:300,date:'2026-10-28'},{kind:'savingsPlan',month:'2026-10',spendingReserve:100,extraExpenses:50});
let f=savingsForecast(rows,'2026-10','2026-10-20');assert.equal(f.cash,650);assert.equal(f.availableNow,350);assert.equal(f.projected,650);assert.equal(f.monthDeposits,50);
assert.equal(savingsForecast(rows.filter(r=>r.kind!=='savingsPlan'),'2026-10','2026-10-20').availableNow,null);
assert.equal(savingsForecast(rows.map(r=>r.name==='Salário'?{...r,paid:false}:r),'2026-10','2026-10-20').availableNow,0);
assert.equal(savingsForecast([...rows,{kind:'transaction',type:'expense',paid:false,amount:100,date:'2026-09-15'}],'2026-10','2026-10-20').availableNow,350);
f=savingsForecast(rows.map(r=>r.kind==='savingsPlan'?{...r,spendingReserve:1000}:r),'2026-10','2026-10-20');assert.equal(f.availableNow,0);assert.equal(f.shortfall,550);
const history=[...rows.filter(r=>r.kind!=='savingsPlan'),{kind:'transaction',type:'expense',paid:true,amount:800,date:'2026-08-01'},{kind:'transaction',type:'expense',paid:true,amount:1200,date:'2026-09-01'},{kind:'savingsPlan',month:'2026-10',spendingReserve:100,extraExpenses:null}];f=savingsForecast(history,'2026-10','2026-10-20');assert.equal(f.average,null);assert.equal(f.extra,200);assert.equal(savingsForecast(rows,'2026-11','2026-10-20').availableNow,null);
console.log('PASS: 2500/50 goal, 2% progress, legacy savings, overfunding, validation, reserved cash, pending income, overdue bills, historic estimates and spending buffer.');

const fixed={kind:'recurringBill',type:'expense',startDate:'2026-10-25',endDate:null};
const base=[
 ...rows.map(row=>row.kind==='transaction'?{...row,paymentMethod:'Dinheiro'}:row),
 {kind:'walletMovement',wallet:'Dinheiro',direction:'in',amount:100,date:'2026-10-02'},
 {kind:'transaction',type:'income',category:'Salário',paid:false,amount:500,date:'2026-10-29'},
 {kind:'transaction',type:'income',category:'Salário',paid:false,amount:999,date:'2026-11-01'},
 {kind:'transaction',type:'expense',paid:false,amount:40,date:'2026-09-25'},
 {...fixed,id:'light',amount:90},
 {...fixed,id:'rent',amount:200},
 {...fixed,id:'paid',amount:300},
 {...fixed,id:'skip',amount:200},
 {...fixed,id:'disabled',amount:200,disabled:true},
 {...fixed,id:'salary',type:'income',category:'Salário',amount:100,autoReceive:true},
 {kind:'recurringSkip',transactionId:'recurring-skip-2026-10-25'},
 {id:'manual-rent',recurringId:'rent',kind:'transaction',type:'expense',paid:false,amount:200,date:'2026-10-25'},
 {id:'recurring-paid-2026-10-25',kind:'transaction',type:'expense',paid:true,paymentMethod:'Dinheiro',amount:300,date:'2026-10-10'},
];
const preview=savingsForecast(base,'2026-10','2026-10-20');
assert.equal(preview.forecastCash,500);
assert.equal(preview.forecastIncome,600);
assert.equal(preview.openBills,440);
assert.equal(preview.scheduledExpenses,90);
assert.equal(preview.forecastSavings,570);
const posted=savingsForecast([...base,{id:'recurring-light-2026-10-25',recurringId:'light',kind:'transaction',type:'expense',paid:false,amount:90,date:'2026-10-25'}],'2026-10','2026-10-25');
assert.equal(posted.scheduledExpenses,0);
assert.equal(posted.forecastSavings,preview.forecastSavings);
console.log('PASS: forecast uses cash wallet balance, salary only, overdue bills and scheduled fixed expenses without double counting.');

await build({entryPoints:['lib/sync-model.ts'],bundle:true,platform:'node',format:'esm',outfile:'work/goals-projection.mjs'});const {project}=await import('../work/goals-projection.mjs');const acknowledged=project({family:'family',records:[{...goal,family:'family'},{...rows[1],family:'family'}]},[{action:'save',family:'family',kind:'goalContribution',entityId:rows[1].id,data:{...rows[1]}}]);assert.equal(acknowledged.records.filter(r=>r.kind==='goalContribution').length,1);assert.equal(goalProgress(goal,acknowledged.records).accumulated,50);console.log('PASS: a committed deposit still in the local queue is projected exactly once.');
