import assert from 'node:assert/strict';
import {walletBalances,validateWalletTransfer} from '../lib/wallets.ts';
const rows=[{kind:'walletMovement',wallet:'Dinheiro',amount:200,direction:'in'},
{kind:'transaction',paymentMethod:'Pix',amount:30,type:'expense',paid:true},
{kind:'transaction',paymentMethod:'Pix',amount:10,type:'income',paid:true},
{kind:'transaction',paymentMethod:'Pix',amount:50,type:'expense',paid:false},
{kind:'transaction',paymentMethod:'Pix',amount:40,type:'expense',paid:true,voided:true},
{kind:'transaction',paymentMethod:'Dinheiro',amount:20,type:'expense',paid:true},
{kind:'transaction',paymentMethod:'Vale-alimentação',amount:5,type:'expense',paid:true}];
assert.deepEqual(walletBalances(rows),{'Dinheiro':160,'Vale-alimentação':-5,'Vale-refeição':0,'Combustível':0});
assert.equal(rows[1].paymentMethod,'Pix');
assert.equal(walletBalances(rows.filter((_,i)=>i!==1)).Dinheiro,190);
console.log('PASS: Pix debit and credit, pending and voided exclusions, separate wallets and deletion recalculation.');

const transfer=validateWalletTransfer({fromWallet:'Dinheiro',toWallet:'Combustível',amount:60,date:'2026-10-27'},rows);
const next=[...rows,{...transfer,kind:'walletTransfer',id:'transfer-1'}];
assert.equal(walletBalances(next).Dinheiro,100);assert.equal(walletBalances(next)['Combustível'],60);
assert.equal(Object.values(walletBalances(next)).reduce((a,b)=>a+b,0),Object.values(walletBalances(rows)).reduce((a,b)=>a+b,0));
for(const invalid of [{toWallet:'Dinheiro'},{fromWallet:'Pix'},{amount:161},{amount:0},{amount:1.001},{date:'2026-02-30'}])assert.throws(()=>validateWalletTransfer({...transfer,...invalid},rows));
console.log('PASS: atomic transfer conserves total and rejects same wallet, invalid values and insufficient funds.');

assert.deepEqual(walletBalances([...rows,{...transfer,kind:'walletTransfer',paid:false}]),walletBalances(rows));
