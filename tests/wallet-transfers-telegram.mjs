import {build} from '../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild/lib/main.js';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
mkdirSync('work',{recursive:true});
await build({entryPoints:['lib/telegram/service.ts','lib/telegram/commands.ts','lib/whatsapp/crypto.ts','app/api/whatsapp/route.ts'],bundle:true,platform:'node',format:'esm',outdir:'work/telegram-test',outbase:'.'});
const service=await import('../work/telegram-test/lib/telegram/service.js');
const commands=await import('../work/telegram-test/lib/telegram/commands.js');
const {digest,signature}=await import('../work/telegram-test/lib/whatsapp/crypto.js');
const old=await import('../work/telegram-test/app/api/whatsapp/route.js');
assert.equal((await old.POST()).status,410);
const sql=new DatabaseSync(':memory:');
for(const f of ['0000_fat_shocker','0001_wealthy_flatman','0002_conscious_scrambler','0003_curious_firebird','0004_optimal_hammerhead','0005_nasty_millenium_guard'])sql.exec(readFileSync('drizzle/'+f+'.sql','utf8').replaceAll('--> statement-breakpoint',''));
class Statement{constructor(query,args=[]){this.query=query;this.args=args}bind(...args){return new Statement(this.query,args)}async run(){const r=sql.prepare(this.query).run(...this.args);return {success:true,meta:{changes:r.changes}}}async first(){return sql.prepare(this.query).get(...this.args)||null}async all(){return {results:sql.prepare(this.query).all(...this.args)}}}
const env={DB:{prepare:q=>new Statement(q),async batch(stmts){sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r}catch(e){sql.exec('ROLLBACK');throw e}}},TELEGRAM_BOT_TOKEN:'123:synthetic-token',TELEGRAM_WEBHOOK_SECRET:'synthetic-secret',TELEGRAM_JOB_SECRET:'synthetic-job',TELEGRAM_BOT_USERNAME:'synthetic_bot'};
sql.prepare('INSERT INTO families VALUES(?,?)').run('family','Test Family');
sql.prepare('INSERT INTO members VALUES(?,?,?,?,?)').run('owner-member','family','owner@example.com','admin','{}');
sql.prepare('INSERT INTO profiles VALUES(?,?,?,?)').run('owner','owner@example.com','Owner','+5585000000000');
sql.prepare('INSERT INTO settings VALUES(?,?)').run('owner','owner');
sql.prepare('INSERT INTO settings VALUES(?,?)').run('rev:family','0');
const pairCode='a'.repeat(48),expires=new Date(Date.now()+600000).toISOString();
sql.prepare('INSERT INTO wa_pairings VALUES(?,?,?,?,?)').run(await digest('telegram:'+pairCode),'owner','owner@example.com','family',expires);
let mediaVariant='',autoProviderReceipt=null;const sent=[];let loseReply=false;const objects=new Map();
env.BUCKET={async delete(k){objects.delete(k)},async put(k,v){objects.set(k,v)},async get(k){const bytes=objects.get(k);return bytes?{body:bytes,size:bytes.length,async arrayBuffer(){return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}}:null}};
globalThis.fetch=async(url,init)=>{
 const u=String(url);if(u==='https://extractor.example.test/'){assert.equal(init.headers.Authorization,'Bearer synthetic-extractor');return Response.json({receipt:autoProviderReceipt})}assert(u.startsWith('https://api.telegram.org/'),'Only Telegram requests expected');
 if(u.includes('/file/bot'))return new Response(new TextEncoder().encode('%PDF-synthetic receipt'+mediaVariant),{headers:{'Content-Type':'application/pdf'}});
 const data=JSON.parse(init.body);
 if(u.endsWith('/getWebhookInfo'))return Response.json({ok:true,result:{url:'https://test.invalid/api/telegram/webhook',allowed_updates:['message'],max_connections:40}});
 if(u.endsWith('/setWebhook')){assert.deepEqual(data.allowed_updates,['message','callback_query']);assert.equal(data.url,'https://test.invalid/api/telegram/webhook');assert.equal(data.secret_token,env.TELEGRAM_WEBHOOK_SECRET);assert.equal(data.drop_pending_updates,false);return Response.json({ok:true,result:true});}
 if(u.endsWith('/getMe'))return Response.json({ok:true,result:{username:'synthetic_bot'}});
 if(u.endsWith('/getFile'))return Response.json({ok:true,result:{file_path:'documents/receipt.pdf',file_size:22}});
 if(u.endsWith('/answerCallbackQuery'))return Response.json({ok:true,result:true});assert(u.endsWith('/sendMessage')||u.endsWith('/editMessageText'));sent.push(data);if(loseReply){loseReply=false;throw Error('lost acknowledgement')}
 return Response.json({ok:true,result:{message_id:sent.length}});
};
let updateId=0;
async function deliver(text,{user=42,group=false,secret=env.TELEGRAM_WEBHOOK_SECRET,id=++updateId,document,caption,contact}={}){
 const tasks=[];const message={message_id:id,date:Math.floor(Date.now()/1000),from:{id:user,is_bot:false},chat:{id:group?-99:user,type:group?'group':'private'},text,caption,...(document?{document}: {}),...(contact?{contact}:{})};
 const r=await service.webhook(new Request('https://test.invalid/api/telegram/webhook',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':secret},body:JSON.stringify({update_id:id,message})}),env,{waitUntil:p=>tasks.push(p)});
 await Promise.all(tasks);return r;
}
assert.equal((await deliver('/saldo',{secret:'wrong'})).status,401);assert.equal(sent.length,0);
await deliver('/saldo',{group:true});assert.equal(sent.length,0);
await deliver('/start '+pairCode);assert.equal(sql.prepare('SELECT user FROM wa_links WHERE phone=?').get('tg:42').user,'owner');assert.equal(sql.prepare('SELECT count(*) n FROM wa_pairings').get().n,0);
await deliver('/menu');assert(sent.at(-1).text.includes('O que você deseja'));assert(sent.at(-1).reply_markup.inline_keyboard);
async function click(data,id=++updateId,user=42){const tasks=[];await service.webhook(new Request('https://test.invalid/api/telegram/webhook',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':env.TELEGRAM_WEBHOOK_SECRET},body:JSON.stringify({update_id:id,callback_query:{id:String(id),data,from:{id:user},message:{message_id:123,date:Math.floor(Date.now()/1000),chat:{id:user,type:'private'}}}})}),env,{waitUntil:p=>tasks.push(p)});await Promise.all(tasks);}
sql.prepare("INSERT INTO records(id,family,kind,data,author) VALUES('transfer-funds','family','walletMovement',?,'owner@example.com')").run(JSON.stringify({wallet:'Dinheiro',direction:'in',amount:100,date:'2026-10-27',name:'Saldo'}));
await deliver('/transferir');await click('mi:from:0');await click('mi:to:3');await deliver('25,50');
const transferConfirm=sent.at(-1).reply_markup.inline_keyboard[0][0].callback_data;
assert(transferConfirm.startsWith('mi:transfer-confirm:'));assert.equal(sql.prepare("SELECT count(*) n FROM records WHERE kind='walletTransfer'").get().n,0);
await click(transferConfirm);await click(transferConfirm);
assert.equal(sql.prepare("SELECT count(*) n FROM records WHERE kind='walletTransfer'").get().n,1);
const transferData=JSON.parse(sql.prepare("SELECT data FROM records WHERE kind='walletTransfer'").get().data);assert.equal(transferData.amount,25.5);assert.equal(transferData.fromWallet,'Dinheiro');assert.equal(transferData.toWallet,'Combustível');
await click('mi:transfer');await click('mi:from:0');await click('mi:to:1');await deliver('999');assert(sent.at(-1).text.includes('Saldo insuficiente'));await click('mi:menu');
await click('mi:transfer');await click('mi:from:0');await click('mi:to:2');await deliver('1');await click('mi:menu');assert.equal(sql.prepare("SELECT count(*) n FROM records WHERE kind='walletTransfer'").get().n,1);
sql.prepare("DELETE FROM records WHERE id='transfer-funds' OR kind='walletTransfer'").run();

console.log('PASS: Telegram transfer confirmation, duplicate callback, cancellation and insufficient funds.');
