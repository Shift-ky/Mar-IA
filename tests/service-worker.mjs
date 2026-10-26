import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const source=readFileSync('public/sw.js','utf8');
assert(!source.includes('importScripts('),'Restart must not fetch a bootstrap script');
const stores=new Map();let network=true,gate=false,redirect=false,failAsset=false,requests=0;
const cacheAPI={async open(key){if(!stores.has(key))stores.set(key,new Map());const data=stores.get(key);return {async put(path,response){data.set(path,response.clone())},async match(path){return data.get(path)?.clone()}}},async keys(){return [...stores.keys()]},async delete(key){return stores.delete(key)}};
function worker(code=source){const events={};const self={location:{origin:'https://mar.test'},addEventListener:(name,fn)=>events[name]=fn,skipWaiting:async()=>{},clients:{claim:async()=>{}}};
 const context=vm.createContext({self,caches:cacheAPI,URL,Response,Error,fetch:async input=>{requests++;if(!network)throw Error('Connection disconnected');const path=typeof input==='string'?input:new URL(input.url).pathname;if(gate)return new Response('<html>Sign in</html>');if(failAsset&&path.endsWith('.woff'))return new Response('Not found',{status:404});const response=new Response(readFileSync(path==='/offline/'?'public/offline/index.html':'public'+path),{headers:{'content-type':path==='/offline/'?'text/html':path.endsWith('.js')?'text/javascript':'application/octet-stream'}});Object.defineProperty(response,'url',{value:'https://mar.test'+(redirect&&path==='/offline/'?'/offline/':path)});Object.defineProperty(response,'redirected',{value:redirect&&path==='/offline/'});return response;}});
 vm.runInContext(code,context);return {events,manifest:vm.runInContext('PRECACHE',context)};
}
async function install(w){let pending;w.events.install({waitUntil:p=>pending=p});await pending;}
async function ready(w){let pending,value;w.events.message({data:'READY',ports:[{postMessage:v=>value=v}],waitUntil:p=>pending=p});await pending;return value;}
function request(w,path,mode='navigate'){let response;w.events.fetch({request:{url:'https://mar.test'+path,method:'GET',mode},respondWith:p=>response=p});return response;}
const first=worker();redirect=true;await install(first);assert.equal((await ready(first)).ready,true,'Canonical host redirect must not break installation');
const cache=stores.get('mar-shell-v2-'+first.manifest.version);const missing=first.manifest.files.find(f=>f.endsWith('.woff')),saved=cache.get(missing);cache.delete(missing);assert.equal((await ready(first)).ready,false);cache.set(missing,saved);
network=false;requests=0;
// New worker context represents closing every app window and restarting with no network.
const reopened=worker();
for(const path of ['/','/?source=pwa','/entrar','/nova-senha','/offline','/offline/','/offline/index.html'])assert((await(await request(reopened,path)).text()).includes('mar-offline-shell'));
for(const path of reopened.manifest.files.filter(p=>p!=='/offline/'))assert((await request(reopened,path,'cors')).ok);
assert.equal(requests,0,'Opening and loading the installed shell must not require the host');
assert.equal(request(reopened,'/api/data','cors'),undefined);assert.equal(request(reopened,'/auth/confirm'),undefined);assert.equal(request(reopened,'/signin-with-chatgpt'),undefined);
network=true;gate=true;const errorPage=worker();assert((await(await request(errorPage,'/')).text()).includes('mar-offline-shell'),'A host offline/login page must not replace a cached application');
await assert.rejects(()=>install(worker(source.replace(first.manifest.version,'gate-failed'))),/Sessão necessária/);gate=false;failAsset=true;await assert.rejects(()=>install(worker(source.replace(first.manifest.version,'update-failed'))),/arquivo offline/);failAsset=false;
network=false;assert((await(await request(reopened,'/')).text()).includes('mar-offline-shell'),'A failed update must preserve the installed application');
network=true;assert((await(await request(reopened,'/')).text()).includes('mar-offline-shell'));assert.equal((await ready(reopened)).ready,true);
console.log('PASS: canonical host redirect, cache-first navigation even with host error pages, all assets offline, closed/reopened worker without network bootstrap, incomplete cache diagnostics, failed-update preservation and reconnection.');
