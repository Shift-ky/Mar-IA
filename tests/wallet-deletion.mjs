import {build} from '../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild/lib/main.js';
import {mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
mkdirSync('work',{recursive:true});
await build({stdin:{contents:"export {deleteWallet} from './lib/wallet-deletion';export {walletNames,walletBalances} from './lib/wallets';export {project} from './lib/sync-model';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:'work/wallet-deletion.mjs'});
const {deleteWallet,walletNames,walletBalances,project}=await import('../work/wallet-deletion.mjs');
const records=[{id:'w',kind:'wallet',name:'Reserva'},{id:'m',kind:'walletMovement',wallet:'Reserva',amount:100,direction:'in',date:'2026-11-01'},{id:'t',kind:'transaction',name:'Compra',paymentMethod:'Reserva',amount:10,type:'expense',paid:true,date:'2026-11-01'},{id:'x',kind:'walletTransfer',fromWallet:'Dinheiro',toWallet:'Reserva',amount:20,paid:true,date:'2026-11-01'},{id:'p',kind:'walletTransfer',fromWallet:'Reserva',toWallet:'Dinheiro',amount:5,paid:false,date:'2026-11-01'},{id:'r',kind:'recurringBill',name:'Conta',type:'expense',paymentMethod:'Reserva',amount:10,startDate:'2026-11-01',endDate:null}];
const before=walletBalances(records),after=deleteWallet(records,'Reserva','marker');
assert.equal(walletBalances(after).Dinheiro,before.Dinheiro+before.Reserva);assert(!walletNames(after).includes('Reserva'));assert.equal(after.find(r=>r.id==='t').paymentMethod,'Dinheiro');assert.equal(after.find(r=>r.id==='r').paymentMethod,'Dinheiro');assert(after.find(r=>r.id==='p').voided);assert(after.find(r=>r.id==='t'));
assert(!walletNames(deleteWallet([],'Vale-alimentação','default-marker')).includes('Vale-alimentação'));assert.throws(()=>deleteWallet(records,'Dinheiro','no'));assert.deepEqual(deleteWallet(after,'Reserva','again'),after);
const view=project({family:'f',email:'qa',records},[{action:'walletDelete',family:'f',wallet:'Reserva',entityId:'offline-marker'}]);assert(!walletNames(view.records).includes('Reserva'));assert.equal(walletBalances(view.records).Dinheiro,before.Dinheiro+before.Reserva);
console.log('PASS: saldos somados, histórico preservado, carteira padrão removida, proteção de Dinheiro, repetição segura e projeção offline.');


const edited = project({family:'f',email:'qa',records}, [{
  action:'save',kind:'wallet',id:'w',family:'f',
  data:{name:'Viagem',currency:'USD'},fxRates:{USD:5},
}]);
assert.equal(walletBalances(edited.records).Viagem,before.Reserva/5);
assert.equal(walletBalances(edited.records).Dinheiro,before.Dinheiro);
assert.equal(edited.records.find(r=>r.id==='m').amount,100);
assert.equal(edited.records.find(r=>r.id==='m').currency,'BRL');
assert.equal(edited.records.find(r=>r.id==='t').paymentMethod,'Viagem');
assert.equal(edited.records.find(r=>r.id==='x').toWallet,'Viagem');
assert.equal(edited.records.find(r=>r.id==='p').fromWallet,'Viagem');
assert.equal(edited.records.find(r=>r.id==='r').paymentMethod,'Viagem');
console.log('PASS: renomeação e mudança de moeda preservam saldos, lançamentos e transferências na projeção offline.');
