import {build} from 'vite';
import {readdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
await build({configFile:'vite.offline.config.ts'});
const files=['/offline/',...(await readdir('public/offline/assets')).map(f=>'/offline/assets/'+f),'/manifest.webmanifest',...(await readdir('public/brand')).map(f=>'/brand/'+f),...(await readdir('public/fonts')).filter(f=>f.endsWith('.woff')).map(f=>'/fonts/'+f)];
const template=await readFile('offline-src/service-worker.js','utf8');
const hash=createHash('sha256').update(template);for(const file of files)hash.update(await readFile(file==='/offline/'?'public/offline/index.html':'public'+file));const version=hash.digest('hex').slice(0,12);
await writeFile('public/precache.js',`self.MAR_PRECACHE=${JSON.stringify({version,files})};`);

await writeFile('public/sw.js',template.replace('__MAR_PRECACHE__',JSON.stringify({version,files})));
