import {build} from '../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild/lib/main.js';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
mkdirSync('work',{recursive:true});
await build({entryPoints:['app/api/data/route.ts'],bundle:true,platform:'node',format:'esm',outfile:'work/feira-api-test.mjs',plugins:[{name:'test-auth',setup(b){b.onResolve({filter:/chatgpt-auth$/},()=>({path:'auth',namespace:'qa'}));b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'qa'}));b.onLoad({filter:/.*/,namespace:'qa'},({path})=>({contents:path==='auth'?'export async function getChatGPTUser(){return globalThis.qaUser;}':'export const env=globalThis.qaEnv;',loader:'js'}));}}]});
const sql=new DatabaseSync(':memory:');
for(const f of ['drizzle/0000_fat_shocker.sql','drizzle/0001_wealthy_flatman.sql','drizzle/0002_conscious_scrambler.sql','drizzle/0003_curious_firebird.sql','drizzle/0004_optimal_hammerhead.sql','drizzle/0005_nasty_millenium_guard.sql'])sql.exec(readFileSync(f,'utf8').replaceAll('--> statement-breakpoint',''));
class Statement{constructor(query,args=[]){this.query=query;this.args=args}bind(...args){return new Statement(this.query,args)}async run(){if(this.query.startsWith('SELECT'))return {results:sql.prepare(this.query).all(...this.args)};const r=sql.prepare(this.query).run(...this.args);return {success:true,meta:{changes:r.changes}}}async first(){return sql.prepare(this.query).get(...this.args)||null}async all(){return {results:sql.prepare(this.query).all(...this.args)}}}
globalThis.qaEnv={DB:{prepare:s=>new Statement(s),async batch(stmts){sql.exec('BEGIN');try{const results=[];for(const stmt of stmts)results.push(await stmt.run());sql.exec('COMMIT');return results}catch(e){sql.exec('ROLLBACK');throw e}}}};
const owner={userId:'qa-owner',email:'owner@example.com',displayName:'QA Owner'};globalThis.qaUser=owner;
const backend=await import('../work/feira-api-test.mjs');
let online=true,loseResponse=false;
globalThis.window=new EventTarget();Object.defineProperty(globalThis,'navigator',{value:{get onLine(){return online}},configurable:true});
globalThis.fetch=async(url,options={})=>{if(!online)throw new TypeError('Network offline');const request=new Request('https://qa.local'+url,options);const r=options.method==='POST'?await backend.POST(request):await backend.GET(request);if(options.method==='POST'&&loseResponse){loseResponse=false;throw new TypeError('Connection lost after commit')}return r};
globalThis.qaLocal=new Map();
await build({entryPoints:['lib/offline.ts'],bundle:true,platform:'node',format:'esm',outfile:'work/feira-offline-test.mjs',plugins:[{name:'test-storage',setup(b){b.onResolve({filter:/local-store$/},()=>({path:'storage',namespace:'qa'}));b.onLoad({filter:/.*/,namespace:'qa'},()=>({contents:`export async function read(k){return structuredClone(globalThis.qaLocal.get(k))} export async function write(k,fn){const v=fn(await read(k));globalThis.qaLocal.set(k,structuredClone(v));return v} export async function clearAccount(a){globalThis.qaLocal.delete('user:'+a);globalThis.qaLocal.delete('active')}`,loader:'js'}));}}]});
const client=await import('../work/feira-offline-test.mjs');let status;const sync=()=>client.synchronize(s=>status=s);
await sync();assert.equal(status.state,'synced');assert.equal((await client.localView()).snapshot.profile,null);await client.enqueue({action:'register',phone:'+5585000000000',name:'QA Owner'});await sync();assert.equal((await client.localView()).snapshot.profile.name,'QA Owner');
const family={entityId:(await client.localView()).snapshot.family};assert(family.entityId);
let state=await client.localView();assert.equal(state.snapshot.family,family.entityId);assert.equal(state.queue.length,0);

await build({entryPoints:['lib/inventory.ts','lib/feira.ts','lib/wallets.ts'],bundle:true,platform:'node',format:'esm',outdir:'work/feira-core'});
const {inventory}=await import('../work/feira-core/inventory.js');const {feiraList}=await import('../work/feira-core/feira.js');const {walletBalances}=await import('../work/feira-core/wallets.js');
const f=family.entityId,date=new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'});
const snap=async()=>(await client.localView()).snapshot;
const perform=async b=>{const op=await client.enqueue({family:f,...b});await sync();const v=await client.localView();assert.equal(v.queue.length,0,JSON.stringify(v.queue));return op;};
const product=await perform({action:'save',kind:'product',data:{name:'Arroz',unit:'un',initial:1,minimum:6}});
const rice=async()=>inventory((await snap()).records).find(p=>p.id===product.entityId);
assert.equal((await rice()).missing,5);let auto=feiraList((await snap()).records)[0];assert.equal(auto.quantity,5);assert.equal(auto.unitPrice,0);
// Offline: selection and checkout use the same pending projection; loss of the commit response cannot duplicate stock or expense.
online=false;await client.enqueue({family:f,action:'feiraItem',id:auto.id,data:{bought:true,purchasedQuantity:2,unitPrice:7}});
const purchase=await client.enqueue({family:f,action:'feiraSave',data:{date,payment:'Dinheiro',items:[{name:'Arroz',unit:'un',quantity:2,unitPrice:7,productId:product.entityId,shoppingId:auto.id}]}});
assert.equal((await rice()).quantity,3);assert.equal(feiraList((await snap()).records)[0].quantity,3);assert.equal(feiraList((await snap()).records)[0].bought,false);assert.equal(walletBalances((await snap()).records).Dinheiro,-14);
online=true;loseResponse=true;await sync();await sync();assert.equal((await client.localView()).queue.length,0);assert.equal((await rice()).quantity,3);assert.equal(walletBalances((await snap()).records).Dinheiro,-14);
assert.equal((await snap()).records.filter(r=>r.kind==='feiraPurchase').length,1);assert.equal((await rice()).lastUnitPrice,7);
// Quotes are archived, preserve exact current selection, and never affect latest paid price.
auto=feiraList((await snap()).records)[0];await perform({action:'feiraItem',id:auto.id,data:{bought:true,purchasedQuantity:3,unitPrice:9}});
const beforeList=feiraList((await snap()).records);const quote=await perform({action:'feiraSave',data:{date,payment:'Não lançar',items:[{name:'Arroz',unit:'un',quantity:3,unitPrice:9,productId:product.entityId,shoppingId:auto.id}]}});
assert.deepEqual(feiraList((await snap()).records),beforeList);assert.equal((await rice()).quantity,3);assert.equal((await rice()).lastUnitPrice,7);assert.equal(walletBalances((await snap()).records).Dinheiro,-14);
// Edit adds only the difference and moves the entire debit to the correct wallet.
await perform({action:'feiraSave',id:purchase.entityId,data:{date,payment:'Alimentação',items:[{name:'Arroz',unit:'un',quantity:5,unitPrice:8,productId:product.entityId}]}});
assert.equal((await rice()).quantity,6);assert.equal((await rice()).minimum,6);assert.equal(feiraList((await snap()).records).length,0);assert.equal(walletBalances((await snap()).records).Dinheiro,0);assert.equal(walletBalances((await snap()).records)['Vale-alimentação'],-40);
await perform({action:'stockMove',productId:product.entityId,delta:-2});assert.equal((await rice()).missing,2);assert.equal(feiraList((await snap()).records)[0].unitPrice,8);
await assert.rejects(()=>client.enqueue({family:f,action:'feiraDelete',id:purchase.entityId}),/negativo/);
// Server also rejects the reversal atomically, independently of client checks.
const post=async b=>backend.POST(new Request('https://qa.local/api/data',{method:'POST',body:JSON.stringify({family:f,account:owner.userId,operationId:crypto.randomUUID(),entityId:crypto.randomUUID(),baseRevision:(await snap()).revision,...b})}));
assert.equal((await post({action:'feiraDelete',id:purchase.entityId})).status,400);assert.equal((await rice()).quantity,4);assert.equal(walletBalances((await snap()).records)['Vale-alimentação'],-40);
await perform({action:'stockMove',productId:product.entityId,delta:2});await perform({action:'feiraDelete',id:purchase.entityId});assert.equal((await rice()).quantity,1);assert.equal(walletBalances((await snap()).records)['Vale-alimentação'],0);assert.equal((await rice()).lastUnitPrice,null);assert.equal(feiraList((await snap()).records)[0].quantity,5);
// Unknown products are created with purchased quantity as minimum; manual partial lists keep the remainder.
const manual=await perform({action:'save',kind:'shoppingItem',data:{name:'Sabonete',quantity:4,unit:'un'}});
const soapPurchase=await perform({action:'feiraSave',data:{date,payment:'Refeição',items:[{name:'Sabonete',unit:'un',quantity:2,unitPrice:3,shoppingId:manual.entityId}]}});
let soap=inventory((await snap()).records).find(r=>r.name==='Sabonete');assert.equal(soap.quantity,2);assert.equal(soap.minimum,2);assert.equal(feiraList((await snap()).records).find(r=>r.id===manual.entityId).quantity,2);assert.equal(walletBalances((await snap()).records)['Vale-refeição'],-6);
await perform({action:'feiraCopy',id:soapPurchase.entityId});assert.equal(feiraList((await snap()).records).filter(r=>r.name==='Sabonete'&&!r.autoStock).length,1);
// No generic transaction endpoint may bypass reconciliation.
assert.equal((await post({action:'delete',id:'ft-'+soapPurchase.entityId})).status,400);
assert.equal((await post({action:'save',kind:'transaction',id:'ft-'+soapPurchase.entityId,data:{name:'Bypass',amount:1,date,type:'expense',paid:true}})).status,400);
// Revoked stock permission filters API data and blocks writes even with general edit/add rights.
sql.prepare("INSERT INTO profiles VALUES(?,?,?,?)").run('qa-member','member@example.com','Membro','5585000000099');sql.prepare("INSERT INTO members VALUES(?,?,?,?,?)").run('qa-member-id',f,'member@example.com','member',JSON.stringify({view:true,add:true,edit:true,delete:true,stock:false}));globalThis.qaUser={userId:'qa-member',email:'member@example.com'};
const restricted=await(await backend.GET(new Request('https://qa.local/api/data?family='+f))).json();assert(!restricted.records.some(r=>['product','stockMovement','purchaseItem','feiraPurchase','productGroup'].includes(r.kind)||r.autoStock));
const forbidden=await backend.POST(new Request('https://qa.local/api/data',{method:'POST',body:JSON.stringify({account:'qa-member',family:f,action:'stockMove',productId:product.entityId,delta:1,operationId:crypto.randomUUID(),entityId:crypto.randomUUID(),baseRevision:restricted.revision})}));assert.equal(forbidden.status,403);
console.log('PASS: Feira offline checkout, lost-response deduplication, partial restock, quote invariance, all wallets, stock delta edits, negative rollback guard, price history, copy, financial lock and stock permission isolation.');
