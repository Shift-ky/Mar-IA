import assert from 'node:assert/strict';
import {build} from '../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild/lib/main.js';
await build({entryPoints:['lib/dashboard-summary.ts'],bundle:true,platform:'node',format:'esm',outfile:'work/dashboard-summary-test.mjs'});
const {dashboardSummary}=await import('../work/dashboard-summary-test.mjs');
const rows=[{id:'initial',kind:'walletMovement',wallet:'Dinheiro',direction:'in',amount:1000,date:'2026-10-01'},
{id:'expense',kind:'transaction',paymentMethod:'Pix',type:'expense',paid:true,amount:100,date:'2026-10-02',category:'Mercado'},
{id:'income',kind:'transaction',paymentMethod:'Dinheiro',type:'income',paid:true,amount:500,date:'2026-10-03'},
{id:'bill',kind:'transaction',type:'expense',paid:false,amount:200,date:'2026-10-10'},
{id:'transfer',kind:'walletTransfer',fromWallet:'Dinheiro',toWallet:'Combustível',paid:true,amount:100,date:'2026-10-04'},
{id:'next-income',kind:'recurringBill',name:'Receita',amount:300,type:'income',startDate:'2026-10-28',endDate:null,paymentMethod:'Dinheiro',autoReceive:true},
{id:'next-expense',kind:'recurringBill',name:'Conta',amount:50,type:'expense',startDate:'2026-10-30',endDate:null,autoReceive:false}];
const before=JSON.stringify(rows),s=dashboardSummary(rows,'2026-10','2026-10-27');
assert.equal(s.balance,1400);assert.equal(s.balances.Dinheiro,1300);assert.equal(s.balances['Combustível'],100);assert.equal(s.received,500);assert.equal(s.paidExpenses,100);assert.equal(s.bills,250);assert.equal(s.expected,300);assert.equal(s.forecast,1450);assert.equal(s.categories[0].value,100);assert.equal(s.trend.at(-1).projected,s.forecast);assert.equal(s.trend[26].actual,1400);assert.equal(s.trend[27].actual,null);assert.equal(JSON.stringify(rows),before);
const duplicate={id:'recurring-next-income-2026-10-28',kind:'transaction',type:'income',date:'2026-10-28',paid:false,amount:300};assert.equal(dashboardSummary([...rows,duplicate],'2026-10','2026-10-27').expected,300);
assert.equal(dashboardSummary([...rows,{id:'skip',kind:'recurringSkip',transactionId:duplicate.id}],'2026-10','2026-10-27').expected,0);
assert.equal(dashboardSummary([...rows,{id:'void',kind:'transaction',date:'2026-10-28',type:'expense',paid:false,amount:999,voided:true}],'2026-10','2026-10-27').bills,250);
assert.equal(dashboardSummary([],'2026-10','2026-10-27').forecast,0);
assert.equal(dashboardSummary([...rows,{id:'future',kind:'transaction',paymentMethod:'Dinheiro',date:'2026-10-29',paid:true,type:'income',amount:20}],'2026-10','2026-10-27').balance,1400);
console.log('PASS: actual wallet balances, Pix, internal transfers, due and scheduled forecast, chart endpoint, no duplicates, exclusions and no mutation.');
