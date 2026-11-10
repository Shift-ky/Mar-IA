import http from 'node:http';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {createWorker} from 'tesseract.js';
const env=process.env,site=new URL(env.MAR_SITE_URL),instance=env.EVOLUTION_INSTANCE||'mar-ia';
for(const key of ['EVOLUTION_API_URL','EVOLUTION_API_KEY','EVOLUTION_BRIDGE_SECRET','EVOLUTION_LOCAL_SECRET'])if(!env[key])throw Error('Configuração ausente: '+key);
if(site.protocol!=='https:'||site.username||site.password||site.pathname!=='/')throw Error('Use a origem HTTPS da Mar IA.');
const path=env.BRIDGE_DB||'./data/bridge.sqlite';mkdirSync(dirname(path),{recursive:true});const db=new DatabaseSync(path);
db.exec("PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS incoming(id TEXT PRIMARY KEY,body TEXT NOT NULL,created INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS receipts(id TEXT PRIMARY KEY,body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sending(id TEXT PRIMARY KEY,lease TEXT NOT NULL)");
let connection='starting',lastSuccess=null,lastError=null,running=false;
let ocrWorkerPromise;
async function readImage(bytes){
 ocrWorkerPromise??=createWorker('por+eng',1,{cachePath:'/data/tessdata'});
 const worker=await ocrWorkerPromise;
 const {data}=await worker.recognize(bytes);
 return String(data.text||'').slice(0,50000);
}
function equal(a,b){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
async function evolution(route,data){const r=await fetch(env.EVOLUTION_API_URL+route,{method:data?'POST':'GET',headers:{apikey:env.EVOLUTION_API_KEY,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(20000),redirect:'error'});if(!r.ok)throw Error('Evolution indisponível (HTTP '+r.status+').');return r.json()}
async function upstream(route,data){const body=JSON.stringify({at:Date.now(),...data}),signature='sha256='+createHmac('sha256',env.EVOLUTION_BRIDGE_SECRET).update(body).digest('hex');const r=await fetch(new URL(route,site),{method:'POST',headers:{'Content-Type':'application/json','X-Mar-Job-Signature':signature,...(env.MAR_SITE_SERVICE_TOKEN?{'OAI-Sites-Authorization':'Bearer '+env.MAR_SITE_SERVICE_TOKEN}:{})},body,signal:AbortSignal.timeout(25000),redirect:'error'});if(!r.ok)throw Error('Mar IA indisponível (HTTP '+r.status+').');return r.json()}
async function initialize(){
 try{await evolution('/instance/connectionState/'+encodeURIComponent(instance))}catch{await evolution('/instance/create',{instanceName:instance,integration:'WHATSAPP-BAILEYS',qrcode:true});}
 await evolution('/webhook/set/'+encodeURIComponent(instance),{webhook:{enabled:true,url:'http://bridge:8788/hooks/'+env.EVOLUTION_LOCAL_SECRET,webhookByEvents:false,webhookBase64:false,events:['MESSAGES_UPSERT','CONNECTION_UPDATE']}});
}
async function tick(){if(running)return;running=true;try{
 const state=await evolution('/instance/connectionState/'+encodeURIComponent(instance));connection=state.instance?.state||'unknown';
 for(const row of db.prepare('SELECT * FROM incoming ORDER BY created LIMIT 10').all()){
 const event=JSON.parse(row.body),media=event.data?.message?.imageMessage||event.data?.message?.documentMessage;let attachment;
 const fileLength=media?.fileLength,mediaBytes=fileLength&&typeof fileLength==='object'?Number(fileLength.low||0)+Number(fileLength.high||0)*4294967296:Number(fileLength||0);
 if(media&&mediaBytes<=20971520){try{const file=await evolution('/chat/getBase64FromMediaMessage/'+encodeURIComponent(instance),{message:event.data,convertToMp4:false});if(typeof file.base64==='string'&&file.base64.length<=27962028){const base64=file.base64.replace(/^data:[^;]+;base64,/, '');attachment={base64};if(media===event.data?.message?.imageMessage||/^image\/(?:jpeg|png)/i.test(media.mimetype||media.mimeType||'')){try{const text=await readImage(Buffer.from(base64,'base64'));if(text.trim())attachment.extractedText=text}catch{}}}}catch{}}
 await upstream('/api/evolution/webhook',{event,...(attachment?{attachment}:{})});db.prepare('DELETE FROM incoming WHERE id=?').run(row.id)}
 for(const row of db.prepare('SELECT * FROM receipts LIMIT 20').all()){await upstream('/api/evolution/bridge',JSON.parse(row.body));db.prepare('DELETE FROM receipts WHERE id=?').run(row.id);db.prepare('DELETE FROM sending WHERE id=?').run(row.id)}
 // Claim messages only while WhatsApp is connected; uncertain sends are never repeated.
 if(connection==='open'){
 const result=await upstream('/api/evolution/bridge',{action:'poll'});
 for(const m of result.messages||[]){let ack={action:'ack',id:m.id,lease:m.lease,state:'needs_review'};
 if(!db.prepare('SELECT id FROM sending WHERE id=?').get(m.id)){
 db.prepare('INSERT INTO sending VALUES(?,?)').run(m.id,m.lease);
 try{const sent=await evolution('/message/sendText/'+encodeURIComponent(instance),{number:m.chat,text:m.text});if(sent.key?.id)ack={...ack,state:'sent',providerId:sent.key.id}}catch{}
 }
 db.prepare('INSERT OR REPLACE INTO receipts VALUES(?,?)').run(m.id,JSON.stringify(ack));
 }
 }
 lastSuccess=new Date().toISOString();lastError=null;
 }catch{lastError='Conexão indisponível. A fila recebida foi preservada; verifique Docker, internet e a configuração da Mar IA.';}finally{running=false}}
const html=`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>WhatsApp • Mar IA</title><style>body{font:17px system-ui;background:#eef4f2;color:#17352e;max-width:650px;margin:40px auto;padding:24px}section{background:white;padding:28px;border-radius:20px}button{padding:14px;border:0;border-radius:10px;background:#146951;color:white;cursor:pointer}img{max-width:280px;width:100%}p{line-height:1.6}</style><section><h1>WhatsApp da Mar IA</h1><p id="state">Consultando conexão…</p><button id="qr">Mostrar QR Code</button><p>Abra o WhatsApp do número da Mar IA → Aparelhos conectados → Conectar aparelho.</p><img id="image" hidden alt="QR Code para conectar o WhatsApp"><p id="error"></p><p>Depois de conectar, abra a aba WhatsApp na Mar IA para vincular sua conta e o grupo da família.</p><p>O Telegram continua independente.</p></section><script>async function status(){try{const s=await(await fetch('/status')).json();document.querySelector('#state').textContent='Conexão: '+({open:'conectada',close:'desconectada',connecting:'conectando'}[s.connection]||s.connection);document.querySelector('#error').textContent=s.lastError||''}catch{}}document.querySelector('#qr').onclick=async()=>{try{const r=await fetch('/qr');const s=await r.json();if(!r.ok)throw Error(s.error);const i=document.querySelector('#image');if(s.base64){i.src=s.base64;i.hidden=false}else document.querySelector('#error').textContent='A conexão já está ativa ou o QR ainda não está pronto. Atualize em alguns segundos.'}catch(e){document.querySelector('#error').textContent=e.message}};status();setInterval(status,5000)</script></html>`;
const server=http.createServer(async(req,res)=>{
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'self'; frame-ancestors 'none'"};
 const send=(status,body,type)=>{res.writeHead(status,{...headers,...(type?{'Content-Type':type}:{})});res.end(typeof body==='string'?body:JSON.stringify(body))};
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/hooks/')){
 if(req.method!=='POST'||!equal(url.pathname,'/hooks/'+env.EVOLUTION_LOCAL_SECRET))return send(401,{error:'Recusado.'});
 let size=0,chunks=[];try{for await(const chunk of req){size+=chunk.length;if(size>1048576)return send(413,{error:'Payload grande.'});chunks.push(chunk)}const payload=JSON.parse(Buffer.concat(chunks));if(payload.instance!==instance)return send(400,{error:'Instância inválida.'});if(payload.event==='connection.update'){connection=payload.data?.state||'unknown';return send(200,{ok:true})}const key=payload.data?.key;if(key?.id&&!key.fromMe)db.prepare('INSERT OR IGNORE INTO incoming VALUES(?,?,?)').run(instance+':'+key.remoteJid+':'+key.id,JSON.stringify({event:payload.event,instance:payload.instance,data:payload.data}),Date.now());send(200,{ok:true});void tick();}catch{send(400,{error:'Payload inválido.'})}return;
 }
 // Local dashboard only: reject arbitrary Host and cross-site browser requests.
 if(!/^(localhost|127\.0\.0\.1):8790$/.test(req.headers.host||'')||req.headers['sec-fetch-site']==='cross-site')return send(403,{error:'Abra pelo endereço local.'});
 if(req.method!=='GET')return send(405,{error:'Método inválido.'});
 if(url.pathname==='/')return send(200,html,'text/html; charset=utf-8');
 if(url.pathname==='/status')return send(200,{connection,lastSuccess,lastError,pending:db.prepare('SELECT count(*) AS n FROM incoming').get().n});
 if(url.pathname==='/qr'){try{const qr=await evolution('/instance/connect/'+encodeURIComponent(instance));return send(200,{base64:qr.base64||null})}catch{return send(503,{error:'A Evolution ainda está iniciando. Aguarde e tente novamente.'})}}
 send(404,{error:'Não encontrado.'});
});
server.listen(8788,'0.0.0.0',()=>console.log('Painel local: http://localhost:8790'));
async function boot(){try{await initialize();await tick()}catch{lastError='Aguardando a Evolution iniciar.';setTimeout(boot,10000)}}
void boot();setInterval(()=>void tick(),5000);
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>{db.close();process.exit(0)}));
