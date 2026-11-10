import {build} from '../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild/lib/main.js';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
mkdirSync('work',{recursive:true});
await build({entryPoints:['lib/telegram/service.ts','lib/telegram/commands.ts','lib/whatsapp/crypto.ts','app/api/whatsapp/route.ts'],bundle:true,platform:'node',format:'esm',outdir:'work/feira-telegram-test',outbase:'.'});
const service=await import('../work/feira-telegram-test/lib/telegram/service.js');
const commands=await import('../work/feira-telegram-test/lib/telegram/commands.js');
const {digest,signature}=await import('../work/feira-telegram-test/lib/whatsapp/crypto.js');
const old=await import('../work/feira-telegram-test/app/api/whatsapp/route.js');
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
for(const type of ['expense','income']){await click('mi:'+type);await deliver('12,50');await click('mi:pay:0');await deliver('Outros');await deliver('Teste interativo');const cb=sent.at(-1).reply_markup.inline_keyboard[0][0].callback_data;await click(cb);const n=sql.prepare('SELECT count(*) n FROM records').get().n;await click(cb);assert.equal(sql.prepare('SELECT count(*) n FROM records').get().n,n);assert(sql.prepare("SELECT data FROM records WHERE id LIKE 'tg-interactive-%' AND json_extract(data,'$.type')=?").get(type));}
await click('mi:add');await deliver('Café; 2; pacote');let item=sql.prepare("SELECT id FROM records WHERE kind='shoppingItem'").get();assert(item);
await deliver('lista de compra');let checks=sent.at(-1).reply_markup.inline_keyboard.flat().filter(b=>b.callback_data?.startsWith('mi:check:'));assert.equal(checks.length,1);assert(checks[0].text.includes('☐ 1. Café'));assert(!sent.at(-1).reply_markup.inline_keyboard.flat().some(b=>/^mi:(edit|delete):/.test(b.callback_data||'')));
const checkId=++updateId;await click(checks[0].callback_data,checkId);await click(checks[0].callback_data,checkId);assert.equal(JSON.parse(sql.prepare('SELECT data FROM records WHERE id=?').get(item.id).data).bought,true);assert(sent.at(-1).reply_markup.inline_keyboard.flat()[0].text.includes('☑'));
await deliver('editar o produto 1');await deliver('3 pacotes de Café');let changed=JSON.parse(sql.prepare('SELECT data FROM records WHERE id=?').get(item.id).data);assert.equal(changed.quantity,3);assert.equal(changed.bought,true);
await deliver('excluir o produto 1');assert(sql.prepare('SELECT id FROM records WHERE id=?').get(item.id));assert(sent.at(-1).text.includes('alterado'));
await deliver('minha lista de compras');await deliver('excluir o produto 1');assert(!sql.prepare('SELECT id FROM records WHERE id=?').get(item.id));await deliver('excluir o produto 1');assert(sent.at(-1).text.includes('não está disponível'));
const naturalId=++updateId;await deliver('adicionar 2 kg de arroz na lista de compras',{id:naturalId});await deliver('adicionar 2 kg de arroz na lista de compras',{id:naturalId});let natural=sql.prepare("SELECT data FROM records WHERE id=?").get('tg-shop-tg:'+naturalId);assert.deepEqual(JSON.parse(natural.data),{name:'arroz',quantity:2,unit:'kg',bought:false});assert.equal(sql.prepare("SELECT count(*) n FROM records WHERE id=?").get('tg-shop-tg:'+naturalId).n,1);
await deliver('adicionar café',{user:43});assert(!sent.at(-1).text.includes('Adicionado à lista'));
await click('mi:add');await deliver('3 pacotes de café');assert(sent.at(-1).text.includes('café · 3 pacote'));await deliver('/compras');assert(JSON.stringify(sent.at(-1)).includes('arroz · 2 kg'));
const beforeBatch=sql.prepare("SELECT count(*) n FROM records WHERE kind='shoppingItem'").get().n;
const batchId=++updateId;await deliver('adicionar 2 arroz, 2 feijão',{id:batchId});await deliver('adicionar 2 arroz, 2 feijão',{id:batchId});assert.equal(sql.prepare("SELECT count(*) n FROM records WHERE kind='shoppingItem'").get().n,beforeBatch+2);
assert.equal(JSON.parse(sql.prepare('SELECT data FROM records WHERE id=?').get('tg-shop-tg:'+batchId+'-1').data).name,'feijão');
await click('mi:add');await deliver('1,5 kg de arroz,2 litros de leite');assert(sent.at(-1).text.includes('arroz · 1.5 kg'));assert(sent.at(-1).text.includes('leite · 2 l'));
let beforeInvalid=sql.prepare('SELECT count(*) n FROM records').get().n;await deliver('adicionar 2 arroz, 0 feijão');assert.equal(sql.prepare('SELECT count(*) n FROM records').get().n,beforeInvalid);
await deliver('2 arroz, 2 feijão');assert(sent.at(-1).text.includes('feijão · 2 un'));
sql.exec("DELETE FROM records WHERE kind='shoppingItem'");
for(let i=1;i<=23;i++)sql.prepare('INSERT INTO records(id,family,kind,data,author) VALUES(?,?,?,?,?)').run('page-'+String(i).padStart(2,'0'),'family','shoppingItem',JSON.stringify({name:'Produto '+i,quantity:1,unit:'un',bought:false}),'owner');
await deliver('/compras 2');assert(JSON.stringify(sent.at(-1)).includes('☐ 21. Produto 21'));await click('mi:shopping-page:1');assert(JSON.stringify(sent.at(-1)).includes('☐ 1. Produto 1'));
sql.prepare('DELETE FROM records WHERE id=?').run('page-01');await deliver('excluir o produto 2');assert(!sql.prepare('SELECT id FROM records WHERE id=?').get('page-02'));assert(sql.prepare('SELECT id FROM records WHERE id=?').get('page-03'));
await deliver('editar o produto 3',{user:43});assert(!sent.at(-1).text.includes('Editar produto 3'));
sql.exec("DELETE FROM records WHERE kind='shoppingItem'");
sql.exec("DELETE FROM records WHERE id LIKE 'tg-interactive-%'");
const beforeGuide=sql.prepare('SELECT count(*) n FROM records').get().n;await deliver('Adicionar despesa');assert(sent.at(-1).text.includes('despesa 32,50'));assert.equal(sql.prepare('SELECT count(*) n FROM records').get().n,beforeGuide);
await deliver('Ver tudo',{user:43});assert(!sent.at(-1).text.includes('Visão geral da sua família'));
const repeat=++updateId;await deliver('despesa 32,50 mercado',{id:repeat});await deliver('despesa 32,50 mercado',{id:repeat});
assert.equal(sql.prepare('SELECT count(*) n FROM records').get().n,1);assert.equal(JSON.parse(sql.prepare('SELECT data FROM records').get().data).source,'telegram');
await deliver('/saldo');assert(sent.at(-1).text.includes('32,50'));assert.equal(sent.at(-1).chat_id,'42');
await deliver('/saldo',{user:43});assert(!sent.at(-1).text.includes('32,50'));
sql.prepare('INSERT INTO records(id,family,kind,data,author) VALUES(?,?,?,?,?)').run('shopping-rice','family','shoppingItem',JSON.stringify({name:'Arroz',unit:'kg',quantity:3.5,bought:false}),'owner');
sql.prepare('INSERT INTO records(id,family,kind,data,author) VALUES(?,?,?,?,?)').run('other-rice','other-family','product',JSON.stringify({name:'Produto privado',unit:'un',initial:0,minimum:9}),'other');
await deliver('/compras');assert(JSON.stringify(sent.at(-1)).includes('Arroz · 3.5 kg'));assert(!sent.at(-1).text.includes('Produto privado'));assert(sent.at(-1).reply_markup.inline_keyboard);
await deliver('/compras',{user:43});assert(!sent.at(-1).text.includes('Arroz'));
sql.prepare("DELETE FROM records WHERE id IN ('shopping-rice','other-rice')").run();
await deliver('',{document:{file_id:'synthetic_file',mime_type:'application/pdf'}});const doc=sql.prepare('SELECT * FROM wa_documents').get();assert.equal(doc.state,'needs_review');assert(doc.id.startsWith('tg-doc-'));assert.equal(objects.size,1);
for(const [text,method] of [['Lançar 50 reais no alimentação','Vale-alimentação'],['50 refeição','Vale-refeição'],['50 em dinheiro','Dinheiro']]){const before=sql.prepare("SELECT count(*) n FROM records WHERE kind='transaction'").get().n;await deliver(text);assert.equal(sql.prepare("SELECT count(*) n FROM records WHERE kind='transaction'").get().n,before+1);assert(sent.at(-1).text.includes(method));}

const stockId='test-stock-auto-12345';sql.prepare('INSERT INTO records VALUES(?,?,?,?,?)').run(stockId,'family','product',JSON.stringify({name:'Reposição automática',unit:'un',initial:1,minimum:4}),'owner@example.com');
await deliver('lista de compra');const autoButton=sent.at(-1).reply_markup.inline_keyboard.flat().find(b=>b.callback_data?.endsWith('replenish-'+stockId));assert(autoButton);assert(autoButton.text.includes('3 un'));await click(autoButton.callback_data);const selected=JSON.parse(sql.prepare('SELECT data FROM records WHERE id=?').get('replenish-'+stockId).data);assert.equal(selected.bought,true);assert.equal(selected.purchasedQuantity,3);await deliver('lista de compra');assert(sent.at(-1).reply_markup.inline_keyboard.flat().find(b=>b.callback_data?.endsWith('replenish-'+stockId)).text.includes('☑'));
console.log('PASS: existing Telegram shopping flows, offline-compatible fields, automatic deficit list and persisted purchase selection.');
