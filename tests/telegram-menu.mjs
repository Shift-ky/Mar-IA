import {build} from '../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild/lib/main.js';
import assert from 'node:assert/strict';
await build({entryPoints:['lib/telegram/commands.ts'],bundle:true,platform:'node',format:'esm',outfile:'work/menu-test.mjs'});
const {parseCommand,guide,availableSummary,overview,menuKeyboard}=await import('../work/menu-test.mjs');
for(const button of menuKeyboard.keyboard.flat()){assert.notEqual(parseCommand(button.text).action,undefined)}
assert.equal(parseCommand('Ver saldo disponível').action,'available');assert.equal(parseCommand('/tudo').action,'overview');
assert.equal(parseCommand('Adicionar lançamento').topic,'entry');assert.equal(parseCommand('adicionar dispeza').topic,'expense');
assert.equal(parseCommand('/despesa').topic,'expense');assert.equal(parseCommand('/despesa 30 mercado').action,'transaction');
assert.equal(parseCommand('Adicionar receita').topic,'income');assert.equal(parseCommand('Relatório do mês').action,'report');
assert(guide('expense').includes('despesa 32,50 supermercado'));assert(guide('income').includes('receita 1500 salario'));
const records=[{kind:'transaction',name:'Receita confirmada',type:'income',amount:100,paid:true,date:'2026-10-24'},{kind:'transaction',name:'Despesa confirmada',type:'expense',amount:30,paid:true,date:'2026-10-24'},{kind:'transaction',name:'Receita prevista',type:'income',amount:500,paid:false,date:'2026-10-25'},{kind:'transaction',name:'Despesa pendente',type:'expense',amount:10,paid:false,date:'2026-10-25'}];
assert(availableSummary(records).includes('70,00'));assert(!availableSummary(records).includes('500,00'));
assert(overview(records).includes('560,00'));assert(overview(records).includes('pendente'));assert.equal(menuKeyboard.is_persistent,true);
console.log('PASS: menu intents, guided entries, pending amounts excluded from available balance and included in overall summary.');
