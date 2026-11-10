import assert from 'node:assert/strict';
import {build} from '../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild/lib/main.js';
await build({entryPoints:['lib/telegram/written-entry.ts'],bundle:true,platform:'node',format:'esm',outfile:'work/written-entry-test.mjs'});
const {writtenEntry}=await import('../work/written-entry-test.mjs');
for(const [method,canonical] of [['Dinheiro','Dinheiro'],['PIX','Pix'],['Alimentação','Vale-alimentação'],['Refeição','Vale-refeição'],['Gasolina','Combustível']]){
 const row=writtenEntry(`saída, 32,50, ${method}, 27/10/2026, Compra, teste`);assert.equal(row.amount,32.5);assert.equal(row.paymentMethod,canonical);assert.equal(row.date,'2026-10-27');assert.equal(row.name,'Compra, teste');assert.equal(row.type,'expense');assert(row.paid);
}
assert.equal(writtenEntry('receita 1.234,56; Dinheiro; 2026-10-27; Salário').amount,1234.56);
assert.equal(writtenEntry('receita 50, Dinheiro, 27/10/2026, Salário').type,'income');
assert.equal(writtenEntry('saldo'),null);assert.equal(writtenEntry('2 arroz, 2 feijão'),null);
for(const text of ['saída, 50, Pix, 31/02/2026, Mercado','saída, 0, Pix, 27/10/2026, Mercado','saída, 50, Cartão, 27/10/2026, Mercado','saída, 50, Pix, 27/10/2026, '])assert.throws(()=>writtenEntry(text));
console.log('PASS: written entries, five wallets, decimal commas, explicit date, description commas, income and invalid data.');

assert.equal(writtenEntry('entrada, 100, Dinheiro, 27/10/2026, Salário').type,'income');
assert.equal(writtenEntry('saida, 50, PIX, 27/10/2026, Mercado').type,'expense');
assert.throws(()=>writtenEntry('50, Pix, 27/10/2026, Mercado'));
