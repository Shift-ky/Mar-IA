import {build} from '../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild/lib/main.js';
import assert from 'node:assert/strict';
await build({entryPoints:['lib/telegram/automatic-proof.ts','lib/telegram/pdf-receipt.ts','lib/whatsapp/receipts.ts'],bundle:true,platform:'node',format:'esm',outdir:'work/automatic-proof',outbase:'lib'});
const {automaticProof,declaredPayment,declaredTransaction}=await import('../work/automatic-proof/telegram/automatic-proof.js');
const {parsePdfReceiptText}=await import('../work/automatic-proof/telegram/pdf-receipt.js');
const {receiptPlan}=await import('../work/automatic-proof/whatsapp/receipts.js');
const extraction=parsePdfReceiptText('Comprovante de pagamento\nValor: R$ 32,50\nData: 25/10/2026');
for(const [caption,method] of [['dinheiro','Dinheiro'],['vale-alimentação','Vale-alimentação'],['VA','Vale-alimentação'],['refeição','Vale-refeição'],['VR','Vale-refeição']]){
 const receipt=automaticProof(extraction,caption);assert.equal(receipt.paymentMethod,method);
 const plan=receiptPlan(receipt,[],'proof','telegram');assert.equal(plan.rows.length,1);assert.equal(plan.rows[0].data.amount,32.5);assert.equal(plan.rows[0].data.paymentMethod,method);assert.equal(plan.rows[0].data.type,'expense');
}
for(const caption of ['','cartão','dinheiro ou alimentação'])assert.equal(automaticProof(extraction,caption),null);
assert.equal(declaredPayment('dinheiro e vale-refeição'),null);
assert.equal(automaticProof(extraction,'50 em dinheiro'),null);
assert.equal(automaticProof(extraction,'32,50 em dinheiro').total,32.5);
assert.equal(automaticProof({...extraction,draft:{...extraction.draft,date:''}},'dinheiro'),null);
assert.equal(automaticProof({...extraction,extraction:'ambiguous'},'dinheiro'),null);
assert.equal(automaticProof({draft:{...extraction.draft,proof:false,items:[]}},'dinheiro'),null);
console.log('PASS: real PDF text extraction through automatic posting plan, all declared payments, ambiguous declarations, missing date and coupon isolation.');

for(const [text,method] of [['Lançar 50 reais no alimentação','Vale-alimentação'],['50 refeição','Vale-refeição'],['50 em dinheiro','Dinheiro']]){const command=declaredTransaction(text,'2026-10-25');assert.equal(command.data.amount,50);assert.equal(command.data.paymentMethod,method);assert.equal(command.data.type,'expense');}assert.equal(declaredTransaction('50 dinheiro e refeição'),null);
