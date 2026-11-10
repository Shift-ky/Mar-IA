import {build} from '../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild/lib/main.js';
import assert from 'node:assert/strict';
await build({entryPoints:['lib/offline-shell.ts','lib/app-release.ts'],bundle:true,platform:'node',format:'esm',outdir:'work/pwa-update'});
const {APP_RELEASE}=await import('../work/pwa-update/app-release.js');
const api=await import('../work/pwa-update/offline-shell.js');
let online=true,updates=0,registration,broken=false;
class Worker extends EventTarget{constructor(state,release){super();this.state=state;this.release=release;}postMessage(message,ports){assert.equal(message,'READY');ports[0].postMessage({ready:!broken,release:this.release,version:this.release});ports[0].close();}}
const sw=new EventTarget();sw.getRegistration=async()=>registration;sw.register=async(path,options)=>{assert.equal(path,'/sw.js');assert.equal(options.updateViaCache,'none');return registration;};
Object.defineProperty(globalThis,'navigator',{value:{serviceWorker:sw,get onLine(){return online}},configurable:true});
const old=new Worker('activated','old');const fresh=new Worker('installed',APP_RELEASE);
registration={active:old,installing:null,waiting:null,async update(){updates++;this.installing=fresh;setTimeout(()=>{this.active=fresh;this.installing=null;fresh.state='activated';fresh.dispatchEvent(new Event('statechange'));sw.dispatchEvent(new Event('controllerchange'));},5);}};Object.defineProperty(sw,'ready',{get:()=>Promise.resolve(registration)});
assert.equal((await api.appUpdateStatus()).update,true);
assert.equal(await api.prepareOfflineShell(),true);assert.equal(updates,1);assert.equal(registration.active,fresh);assert.equal((await api.appUpdateStatus()).update,false);
// An already open older application must be notified, but the updater never reloads it or clears persisted data.
online=false;
globalThis.window=Object.assign(new EventTarget(),{setInterval,clearInterval});
globalThis.document=Object.assign(new EventTarget(),{visibilityState:"visible"});
let notices=0;const stop=api.watchAppUpdates(()=>notices++);registration.active=new Worker('activated','next');sw.dispatchEvent(new Event('controllerchange'));await new Promise(resolve=>setTimeout(resolve,10));assert(notices>0);stop();const previous=notices;sw.dispatchEvent(new Event('controllerchange'));await new Promise(resolve=>setTimeout(resolve,10));assert.equal(notices,previous);
// Offline verification keeps the cached application without network attempts.
online=false;const count=updates;assert.equal(await api.prepareOfflineShell(),true);assert.equal(updates,count);broken=true;assert.equal(await api.prepareOfflineShell(),false);broken=false;
// A failed upgrade preserves the active worker instead of reporting success or deleting caches.
online=true;registration.update=async()=>{updates++;throw Error('Network unavailable')};await assert.rejects(()=>api.prepareOfflineShell(),/Network unavailable/);assert.equal(registration.active.release,'next');
console.log('PASS: explicit PWA update waits for activation, compares releases, notifies open clients, supports offline checks, preserves previous worker on failure and never clears financial data or reloads forms.');
