import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const events={},stores=new Map();let network=true,gate=false,claimed=false;
const caches={async open(k){if(!stores.has(k))stores.set(k,new Map());const m=stores.get(k);return {async put(p,r){m.set(p,r.clone())},async match(p){return m.get(p)?.clone()}}},async keys(){return [...stores.keys()]},async delete(k){return stores.delete(k)}};
const self={addEventListener:(n,f)=>events[n]=f,skipWaiting:async()=>{},clients:{claim:async()=>{claimed=true}}};
const ctx=vm.createContext({self,caches,location:{origin:'https://mar.test'},URL,Response,AbortSignal,Error,fetch:async u=>{if(!network)throw Error('offline');if(gate)return new Response('<html>Sign in</html>');const path=typeof u==='string'?u:new URL(u.url).pathname;return new Response(path==='/'?'Network app':readFileSync('public'+path))},importScripts:()=>vm.runInContext(readFileSync('public/precache.js','utf8'),ctx)});
vm.runInContext(readFileSync('public/sw.js','utf8'),ctx);
let pending;events.install({waitUntil:p=>pending=p});await pending;await caches.open('mar-shell-old');events.activate({waitUntil:p=>pending=p});await pending;assert(claimed);assert(!(await caches.keys()).includes('mar-shell-old'));
let response;function event(path,mode='navigate'){response=null;events.fetch({request:{url:'https://mar.test'+path,method:'GET',mode},respondWith:p=>response=p});return response}
network=false;const shell=await event('/');assert((await shell.text()).includes('mar-offline-shell'));const js=self.MAR_PRECACHE.files.find(f=>f.endsWith('.js'));assert((await(await event(js,'cors')).text()).includes('createElement'));assert.equal(event('/api/data','cors'),null);assert.equal(event('/signin-with-chatgpt'),null);network=true;gate=true;events.install({waitUntil:p=>pending=p});await assert.rejects(()=>pending,/Sessão necessária/);
console.log('PASS: offline navigation fallback, cached application assets, API/login excluded, cache upgrade, sign-in page rejected during preparation.');
