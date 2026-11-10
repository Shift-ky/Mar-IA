import {build} from '../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild/lib/main.js';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdirSync} from 'node:fs';
import {createHmac,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
mkdirSync('work',{recursive:true});
await build({entryPoints:['lib/evolution/service.ts'],bundle:true,platform:'node',format:'esm',outfile:'work/evolution-test.mjs'});
const service=await import('../work/evolution-test.mjs'),sql=new DatabaseSync(':memory:');
for(const file of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+file,'utf8').replaceAll('--> statement-breakpoint',''));
class Statement{constructor(query,args=[]){this.query=query;this.args=args}bind(...args){return new Statement(this.query,args)}async run(){const r=sql.prepare(this.query).run(...this.args);return {success:true,meta:{changes:r.changes}}}async first(){return sql.prepare(this.query).get(...this.args)||null}async all(){return {results:sql.prepare(this.query).all(...this.args)}}}
const env={DB:{prepare:q=>new Statement(q),async batch(stmts){sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r}catch(e){sql.exec('ROLLBACK');throw e}}},EVOLUTION_BRIDGE_SECRET:'synthetic-secret',EVOLUTION_INSTANCE:'mar-ia'};
const sender='5585999999999@s.whatsapp.net',group='120363123456789@g.us',hash=s=>createHash('sha256').update(s).digest('hex');
for(const [f,u,email] of [['family','owner','owner@example.com'],['other','other','other@example.com']]){sql.prepare('INSERT INTO families VALUES(?,?)').run(f,f);sql.prepare('INSERT INTO members VALUES(?,?,?,?,?)').run(u,f,email,'admin','{}');sql.prepare('INSERT INTO profiles VALUES(?,?,?,?)').run(u,email,u,'+5585999999999');sql.prepare('INSERT INTO settings VALUES(?,?)').run('rev:'+f,'0')}
let id=0;
function req(route,data,secret=env.EVOLUTION_BRIDGE_SECRET){const body=JSON.stringify({at:Date.now(),...data});return new Request('https://test.invalid/api/evolution/'+route,{method:'POST',body,headers:{'X-Mar-Job-Signature':'sha256='+createHmac('sha256',secret).update(body).digest('hex')}})}
function event(text,options={}){return {event:'messages.upsert',instance:options.instance||'mar-ia',data:{key:{id:options.id||'msg'+(++id),remoteJid:options.group?group:sender,...(options.group?{participant:sender}:{})},messageTimestamp:Math.floor(Date.now()/1000),message:{conversation:text}}}}
async function deliver(text,options={}){return service.webhook(req('webhook',{event:event(text,options)}),env)}
async function pair(code,kind='person'){sql.prepare('INSERT INTO ev_pairings VALUES(?,?,?,?,?,?)').run(hash('evolution:'+code),'owner','owner@example.com','family',kind,new Date(Date.now()+600000).toISOString());await deliver((kind==='group'?'Maria, ':'')+'vincular '+code,{group:kind==='group'})}
assert.equal((await service.webhook(req('webhook',{event:event('saldo')},'bad'),env)).status,401);
await pair('a'.repeat(48));assert.equal(sql.prepare('SELECT family FROM ev_links WHERE sender=?').get(sender).family,'family');assert.equal(sql.prepare('SELECT count(*) n FROM ev_pairings').get().n,0);
await deliver('despesa 32,50 mercado',{id:'duplicate'});await deliver('despesa 32,50 mercado',{id:'duplicate'});
assert.equal(sql.prepare('SELECT count(*) n FROM records').get().n,1);assert.equal(JSON.parse(sql.prepare('SELECT data FROM records').get().data).amount,32.5);
assert.equal(sql.prepare('SELECT count(*) n FROM wa_inbox').get().n,0);assert.equal(sql.prepare('SELECT count(*) n FROM wa_outbox').get().n,0);assert.equal(sql.prepare('SELECT count(*) n FROM wa_links').get().n,0);
await pair('b'.repeat(48),'group');assert.equal(sql.prepare('SELECT family FROM ev_groups').get().family,'family');
await deliver('despesa 20 mercado',{group:true});assert.equal(sql.prepare('SELECT count(*) n FROM records').get().n,1);
await deliver('Maria, despesa 20 mercado',{group:true});assert.equal(sql.prepare('SELECT count(*) n FROM records').get().n,2);
await deliver('despesa 100 wrong',{instance:'other-instance'});assert.equal(sql.prepare('SELECT count(*) n FROM records').get().n,2);
sql.prepare("UPDATE members SET role='member',permissions='{}' WHERE id='owner'").run();
await deliver('despesa 999 forbidden');assert.equal(sql.prepare('SELECT count(*) n FROM records').get().n,2);
const polled=await(await service.bridge(req('bridge',{action:'poll'}),env)).json();assert(polled.messages.length>0);
assert(!polled.messages.some(m=>m.text.includes('32,50')||m.text.includes('20,00')),'Financial replies blocked after permission revocation');
const again=await(await service.bridge(req('bridge',{action:'poll'}),env)).json();assert.equal(again.messages.length,0,'Leased messages must not be sent twice');
const m=polled.messages[0];await service.bridge(req('bridge',{action:'ack',id:m.id,lease:'wrong',state:'sent'}),env);assert.equal(sql.prepare('SELECT state FROM ev_outbox WHERE id=?').get(m.id).state,'sending');
await service.bridge(req('bridge',{action:'ack',id:m.id,lease:m.lease,state:'sent',providerId:'provider-1'}),env);assert.equal(sql.prepare('SELECT state FROM ev_outbox WHERE id=?').get(m.id).state,'sent');
sql.prepare("UPDATE members SET role='admin' WHERE id='owner'").run();
await deliver('saldo');sql.prepare("UPDATE ev_links SET family='other',user='other',email='other@example.com' WHERE sender=?").run(sender);
await service.bridge(req('bridge',{action:'poll'}),env);assert.equal(sql.prepare("SELECT count(*) n FROM ev_outbox WHERE body LIKE '%Saldo dos lançamentos%' AND state='blocked'").get().n,1);
sql.prepare("DELETE FROM families WHERE id='family'").run();assert.equal(sql.prepare('SELECT count(*) n FROM ev_groups').get().n,0);
assert.equal(sql.prepare("SELECT count(*) n FROM ev_outbox WHERE json_extract(context,'$.family')='family'").get().n,0);
console.log('PASS: Evolution authentication, one-use pairing, family/group isolation, duplicate protection, permission revocation, delivery leases, acknowledgements, deletion cleanup and independent Telegram tables.');
