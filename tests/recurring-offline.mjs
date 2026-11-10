import {build} from '../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild/lib/main.js';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
mkdirSync('work',{recursive:true});
await build({entryPoints:['app/api/data/route.ts'],bundle:true,platform:'node',format:'esm',outfile:'work/api-test.mjs',plugins:[{name:'test-auth',setup(b){b.onResolve({filter:/chatgpt-auth$/},()=>({path:'auth',namespace:'qa'}));b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'qa'}));b.onLoad({filter:/.*/,namespace:'qa'},({path})=>({contents:path==='auth'?'export async function getChatGPTUser(){return globalThis.qaUser;}':'export const env=globalThis.qaEnv;',loader:'js'}));}}]});
const sql=new DatabaseSync(':memory:');
for(const f of ['drizzle/0000_fat_shocker.sql','drizzle/0001_wealthy_flatman.sql','drizzle/0002_conscious_scrambler.sql','drizzle/0003_curious_firebird.sql','drizzle/0004_optimal_hammerhead.sql','drizzle/0005_nasty_millenium_guard.sql'])sql.exec(readFileSync(f,'utf8').replaceAll('--> statement-breakpoint',''));
class Statement{constructor(query,args=[]){this.query=query;this.args=args}bind(...args){return new Statement(this.query,args)}async run(){if(this.query.startsWith('SELECT'))return {results:sql.prepare(this.query).all(...this.args)};const r=sql.prepare(this.query).run(...this.args);return {success:true,meta:{changes:r.changes}}}async first(){return sql.prepare(this.query).get(...this.args)||null}async all(){return {results:sql.prepare(this.query).all(...this.args)}}}
globalThis.qaEnv={DB:{prepare:s=>new Statement(s),async batch(stmts){sql.exec('BEGIN');try{const results=[];for(const stmt of stmts)results.push(await stmt.run());sql.exec('COMMIT');return results}catch(e){sql.exec('ROLLBACK');throw e}}}};
const owner={userId:'qa-owner',email:'owner@example.com',displayName:'QA Owner'};globalThis.qaUser=owner;
const backend=await import('../work/api-test.mjs');
let online=true,loseResponse=false;
globalThis.window=new EventTarget();Object.defineProperty(globalThis,'navigator',{value:{get onLine(){return online}},configurable:true});
globalThis.fetch=async(url,options={})=>{if(!online)throw new TypeError('Network offline');const request=new Request('https://qa.local'+url,options);const r=options.method==='POST'?await backend.POST(request):await backend.GET(request);if(options.method==='POST'&&loseResponse){loseResponse=false;throw new TypeError('Connection lost after commit')}return r};
globalThis.qaLocal=new Map();
await build({entryPoints:['lib/offline.ts'],bundle:true,platform:'node',format:'esm',outfile:'work/offline-test.mjs',plugins:[{name:'test-storage',setup(b){b.onResolve({filter:/local-store$/},()=>({path:'storage',namespace:'qa'}));b.onLoad({filter:/.*/,namespace:'qa'},()=>({contents:`export async function read(k){return structuredClone(globalThis.qaLocal.get(k))} export async function write(k,fn){const v=fn(await read(k));globalThis.qaLocal.set(k,structuredClone(v));return v} export async function clearAccount(a){globalThis.qaLocal.delete('user:'+a);globalThis.qaLocal.delete('active')}`,loader:'js'}));}}]});
const client=await import('../work/offline-test.mjs');let status;const sync=()=>client.synchronize(s=>status=s);
await sync();assert.equal(status.state,'synced');assert.equal((await client.localView()).snapshot.profile,null);await client.enqueue({action:'register',phone:'+5585000000000',name:'QA Owner'});await sync();assert.equal((await client.localView()).snapshot.profile.name,'QA Owner');
const family={entityId:(await client.localView()).snapshot.family};assert(family.entityId);
let state=await client.localView();assert.equal(state.snapshot.family,family.entityId);assert.equal(state.queue.length,0);

const current=new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'});const [year,month,day]=current.split('-').map(Number);const end=new Date(Date.UTC(year,month+2,28)).toISOString().slice(0,10);
online=false;const rule=await client.enqueue({action:'save',family:family.entityId,kind:'recurringBill',data:{name:'Internet',amount:100,type:'expense',startDate:current,endDate:end,autoReceive:false}});let snapshot=(await client.localView()).snapshot;assert(snapshot.records.some(r=>r.recurringId===rule.entityId));const offlineOccurrence=snapshot.records.find(r=>r.recurringId===rule.entityId);await client.enqueue({action:'save',family:family.entityId,kind:'transaction',id:offlineOccurrence.id,data:{...offlineOccurrence,paid:true}});assert.equal((await client.localView()).snapshot.records.find(r=>r.id===offlineOccurrence.id).paid,true);online=true;loseResponse=true;await sync();await sync();snapshot=(await client.localView()).snapshot;assert.equal((await client.localView()).queue.length,0);const firstCount=snapshot.records.filter(r=>r.recurringId===rule.entityId).length;await sync();assert.equal((await client.localView()).snapshot.records.filter(r=>r.recurringId===rule.entityId).length,firstCount);
const occurrence=snapshot.records.find(r=>r.recurringId===rule.entityId);await client.enqueue({action:'save',family:family.entityId,kind:'transaction',id:occurrence.id,data:{...occurrence,paid:true}});await sync();assert.equal((await client.localView()).queue.length,0);let paid=JSON.parse(sql.prepare('SELECT data FROM records WHERE id=?').get(occurrence.id).data);assert.equal(paid.paid,true);assert.equal(paid.recurringId,rule.entityId);assert.equal(paid.recurringManual,true);
assert(!(await client.localView()).snapshot.records.some(r=>r.recurringId===rule.entityId&&r.date>current));
await client.enqueue({action:'save',family:family.entityId,kind:'recurringBill',id:rule.entityId,data:{...rule.data,amount:150}});await sync();snapshot=(await client.localView()).snapshot;assert.equal(Number(snapshot.records.find(r=>r.id===occurrence.id).amount),100);assert(snapshot.records.filter(r=>r.recurringId===rule.entityId&&r.kind==='transaction'&&!r.paid).every(r=>Number(r.amount)===150));
await client.enqueue({action:'delete',family:family.entityId,id:rule.entityId});await sync();assert((await client.localView()).snapshot.records.some(r=>r.id===occurrence.id));assert(!(await client.localView()).snapshot.records.some(r=>r.kind==='transaction'&&r.recurringId===rule.entityId&&!r.paid&&r.date>=current));
const salary=await client.enqueue({action:'save',family:family.entityId,kind:'recurringBill',data:{name:'Salário previsto',amount:1000,type:'income',startDate:current,endDate:null,autoReceive:false}});await sync();assert((await client.localView()).snapshot.records.filter(r=>r.recurringId===salary.entityId&&r.kind==='transaction').every(r=>!r.paid));
const confirmed=await client.enqueue({action:'save',family:family.entityId,kind:'recurringBill',data:{name:'Receita automática',amount:200,type:'income',startDate:current,endDate:null,autoReceive:true}});await sync();assert((await client.localView()).snapshot.records.some(r=>r.recurringId===confirmed.entityId&&r.date===current&&r.paid));console.log('PASS: recurring accounts persist offline, survive response loss without duplicates, confirm payments, preserve exclusions, update future pending entries and retain confirmed history.');

for(const paymentMethod of ['Dinheiro','Vale-alimentação','Vale-refeição']){
 online=false;
 const r=await client.enqueue({action:'save',family:family.entityId,kind:'recurringBill',data:{name:'Receita '+paymentMethod,amount:75,type:'income',paymentMethod,startDate:current,endDate:null,autoReceive:true}});
 assert((await client.localView()).snapshot.records.some(row=>row.recurringId===r.entityId&&row.paymentMethod===paymentMethod&&row.paid));
 online=true;await sync();assert.equal((await client.localView()).queue.length,0);
 assert(JSON.parse(sql.prepare('SELECT data FROM records WHERE id=?').get(r.entityId).data).paymentMethod===paymentMethod);
 assert((await client.localView()).snapshot.records.filter(row=>row.recurringId===r.entityId).every(row=>row.paymentMethod===paymentMethod));
}
console.log('PASS: all three income wallets persist offline and through server synchronization.');

const tomorrow=new Date(Date.parse(current+'T12:00:00Z')+86400000).toISOString().slice(0,10);
for(const type of ['expense','income']){
 const planned=await client.enqueue({action:'save',family:family.entityId,kind:'recurringBill',data:{name:'Agendado '+type,amount:50,type,startDate:tomorrow,endDate:null,autoReceive:type==='income'}});
 assert(!(await client.localView()).snapshot.records.some(row=>row.recurringId===planned.entityId));await sync();
 assert(!(await client.localView()).snapshot.records.some(row=>row.recurringId===planned.entityId));
 const legacy={name:'Parcela antecipada',amount:50,type,date:tomorrow,paid:false,source:'recurring',recurringId:planned.entityId,recurringManual:false};
 for(const [suffix,extra] of [['automatic',{}],['paid',{paid:true}],['manual',{recurringManual:true}]])sql.prepare('INSERT INTO records(id,family,kind,data,author) VALUES(?,?,?,?,?)').run(planned.entityId+suffix,family.entityId,'transaction',JSON.stringify({...legacy,...extra}),owner.email);
 await sync();
 assert(!sql.prepare('SELECT id FROM records WHERE id=?').get(planned.entityId+'automatic'));
 assert(sql.prepare('SELECT id FROM records WHERE id=?').get(planned.entityId+'paid'));
 assert(sql.prepare('SELECT id FROM records WHERE id=?').get(planned.entityId+'manual'));
}
console.log('PASS: future income/expenses remain scheduled; server removes premature automatic entries and preserves paid/manual history.');
