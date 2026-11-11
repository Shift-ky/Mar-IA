import {build} from '../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild/lib/main.js';import assert from 'node:assert/strict';
await build({entryPoints:['lib/recurring.ts'],bundle:true,platform:'node',format:'esm',outfile:'work/recurring-test.mjs'});const {validateRecurring,recurringOccurrences,mergeRecurring}=await import('../work/recurring-test.mjs');
const rule={id:'rule',family:'family',kind:'recurringBill',name:'Aluguel',amount:100,type:'expense',startDate:'2026-01-31',endDate:'2026-03-31',autoReceive:false};const rows=recurringOccurrences(rule,'2026-02-01');assert.deepEqual(rows.map(r=>r.data.date),['2026-01-31']);assert(rows.every(r=>!r.data.paid));assert.equal(mergeRecurring([rule], '2026-02-01').length,2);assert.equal(mergeRecurring(mergeRecurring([rule],'2026-02-01'),'2026-02-01').length,2);
const income={...rule,type:'income',autoReceive:true};assert.deepEqual(recurringOccurrences(income,'2026-02-28').map(r=>r.data.paid),[true,true]);const manual={...rows[0].data,id:rows[0].id,kind:'transaction',paid:false,recurringManual:true};assert.equal(mergeRecurring([income,manual],'2026-02-28').find(r=>r.id===manual.id).paid,false);assert(!mergeRecurring([rule,{id:'skip',kind:'recurringSkip',transactionId:rows[0].id}],'2026-02-01').some(r=>r.id===rows[0].id));assert.throws(()=>validateRecurring({...rule,endDate:'2025-01-01'}));assert.throws(()=>validateRecurring({...rule,amount:-1}));assert(recurringOccurrences({...rule,endDate:null},'2026-02-01').length===1);console.log('PASS: monthly fixed expenses/income, month-end dates, finite/infinite rules, auto-receive, manual overrides, skip markers and idempotent projection.');

const transfer=validateRecurring({...rule,type:'transfer'});
const scheduled=recurringOccurrences({...transfer,id:'fuel'},'2026-02-01');
assert(scheduled.every(r=>r.kind==='walletTransfer'&&r.data.paid===false&&r.data.fromWallet==='Dinheiro'&&r.data.toWallet==='Combustível'));
assert.equal(mergeRecurring([{...transfer,id:'fuel',kind:'recurringBill'}],'2026-02-01').filter(r=>r.kind==='walletTransfer').length,1);
console.log('PASS: monthly fuel transfer remains pending and separate from expenses.');

for(const paymentMethod of ['Dinheiro','Vale-alimentação','Vale-refeição']){
 const saved=validateRecurring({...income,paymentMethod});assert.equal(saved.paymentMethod,paymentMethod);
 assert(recurringOccurrences({...saved,id:'income-wallet'},'2026-02-28').every(r=>r.data.paymentMethod===paymentMethod));
}
assert.throws(()=>validateRecurring({...income,paymentMethod:'Pix'}));
assert.equal(validateRecurring({...rule,paymentMethod:'Dinheiro'}).paymentMethod,'Dinheiro');
const benefit={id:'benefit-wallet',kind:'wallet',name:'Auxilio',type:'beneficio',currency:'BRL',showInRecurring:false};
const benefitIncome=validateRecurring({...income,paymentMethod:benefit.name},[benefit]);
assert.equal(benefitIncome.paymentMethod,benefit.name);
assert(recurringOccurrences({...benefitIncome,id:'benefit-income'},'2026-02-28').every(row=>row.data.paymentMethod===benefit.name));
assert.throws(()=>validateRecurring({...rule,paymentMethod:benefit.name},[benefit]));
assert.throws(()=>validateRecurring({...income,paymentMethod:benefit.name},[{...benefit,currency:'USD'}]));
console.log('PASS: recurring income wallet selection validated and copied to every occurrence.');

for(const type of ['expense','income','transfer']){
 const r={...rule,id:'scheduled-'+type,type,startDate:'2026-10-28',endDate:null,autoReceive:type==='income'};
 assert.equal(recurringOccurrences(r,'2026-10-27').length,0);
 assert.equal(recurringOccurrences(r,'2026-10-28').length,1);
 assert.equal(recurringOccurrences(r,'2026-11-27').length,1);
 assert.equal(recurringOccurrences(r,'2026-11-28').length,2);
 const future={...recurringOccurrences(r,'2026-10-28')[0].data,id:'legacy',kind:type==='transfer'?'walletTransfer':'transaction',paid:false};
 assert(!mergeRecurring([r,future],'2026-10-27').some(row=>row.id==='legacy'));
 assert(mergeRecurring([r,{...future,paid:true}],'2026-10-27').some(row=>row.id==='legacy'));
 assert(mergeRecurring([r,{...future,recurringManual:true}],'2026-10-27').some(row=>row.id==='legacy'));
}
console.log('PASS: scheduled-day boundary, no future generation, legacy future cleanup and confirmed/manual preservation.');
