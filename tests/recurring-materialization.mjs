import {build} from '../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild/lib/main.js';
import {DatabaseSync} from 'node:sqlite';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
mkdirSync('work',{recursive:true});
await build({entryPoints:['lib/recurring.ts'],bundle:true,platform:'node',format:'esm',outfile:'work/recurring-materialization.mjs'});
const {ensureRecurring,mergeRecurring}=await import('../work/recurring-materialization.mjs');
const sql=new DatabaseSync(':memory:');sql.exec('CREATE TABLE records(id TEXT PRIMARY KEY,family TEXT,kind TEXT,data TEXT,author TEXT)');
class Statement{constructor(query,args=[]){this.query=query;this.args=args}bind(...args){return new Statement(this.query,args)}async first(){return sql.prepare(this.query).get(...this.args)}async all(){return {results:sql.prepare(this.query).all(...this.args)}}async run(){return sql.prepare(this.query).run(...this.args)}}
const db={prepare:q=>new Statement(q),batch:async statements=>{for(const statement of statements)await statement.run()}};
const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'});
const rule={name:'Conta importada',amount:25,type:'expense',startDate:today,endDate:null,autoReceive:false,paymentMethod:'Carteira personalizada',sourcePocketId:'legacy-123',extra:'preservado'};
sql.prepare('INSERT INTO records VALUES(?,?,?,?,?)').run('rule','family','recurringBill',JSON.stringify(rule),'qa');
const local=mergeRecurring([{...rule,id:'rule',family:'family',kind:'recurringBill',author:'qa'}]);
const pending=local.find(r=>r.kind==='transaction');assert(pending);
await ensureRecurring(db,'family');assert(sql.prepare('SELECT id FROM records WHERE id=?').get(pending.id));
await ensureRecurring(db,'family');assert.equal(sql.prepare("SELECT count(*) n FROM records WHERE kind='transaction'").get().n,1);
sql.prepare('DELETE FROM records WHERE id=?').run(pending.id);sql.prepare('INSERT INTO records VALUES(?,?,?,?,?)').run('skip-'+pending.id,'family','recurringSkip',JSON.stringify({transactionId:pending.id}),'qa');await ensureRecurring(db,'family');assert.equal(sql.prepare("SELECT count(*) n FROM records WHERE kind='transaction'").get().n,0);
console.log('PASS: conta importada e carteira personalizada materializadas, sem duplicar nem restaurar exclusão intencional.');
