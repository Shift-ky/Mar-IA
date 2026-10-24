import {build} from '../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild/lib/main.js';
import {Miniflare,createFetchMock} from '../node_modules/.pnpm/miniflare@4.20260515.0_@types+node@22.19.19/node_modules/miniflare/dist/src/index.js';
import {createHmac} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
mkdirSync('work',{recursive:true});
await build({stdin:{contents:"import {jobs} from './lib/telegram/service';export default {fetch:jobs};",resolveDir:process.cwd()},bundle:true,platform:'browser',format:'esm',outfile:'work/telegram-runtime-worker.js'});
const mock=createFetchMock();mock.disableNetConnect();
mock.get('https://api.telegram.org').intercept({path:'/bot123:synthetic-token/getMe',method:'POST'}).reply(200,JSON.stringify({ok:true,result:{username:'synthetic_bot'}}),{headers:{'Content-Type':'application/json'}});
const mf=new Miniflare({modules:true,compatibilityDate:'2026-05-15',scriptPath:'work/telegram-runtime-worker.js',fetchMock:mock,bindings:{TELEGRAM_BOT_TOKEN:'123:synthetic-token',TELEGRAM_JOB_SECRET:'synthetic-job-secret'}});
try{
 const body=JSON.stringify({at:Date.now(),diagnostic:true});const signature='sha256='+createHmac('sha256','synthetic-job-secret').update(body).digest('hex');
 const response=await mf.dispatchFetch('https://test.invalid/api/telegram/jobs',{method:'POST',body,headers:{'X-Mar-Job-Signature':signature}});
 const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));assert.deepEqual(result,{ok:true,username:'synthetic_bot'});
 const rejected=await mf.dispatchFetch('https://test.invalid/api/telegram/jobs',{method:'POST',body});assert.equal(rejected.status,401);
 console.log('PASS: Telegram request reaches the mocked API in the actual Workers runtime; signed diagnostic succeeds and unauthorized requests fail.');
}finally{await mf.dispose();mock.close()}
