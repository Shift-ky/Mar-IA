import {build} from 'vite';
import {readdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
await build({configFile:'vite.offline.config.ts'});
const files=['/offline/index.html',...(await readdir('public/offline/assets')).map(f=>'/offline/assets/'+f),'/manifest.webmanifest',...(await readdir('public/brand')).map(f=>'/brand/'+f),...(await readdir('public/fonts')).filter(f=>f.endsWith('.woff')).map(f=>'/fonts/'+f)];
const hash=createHash('sha256');for(const file of files)hash.update(await readFile('public'+file));const version=hash.digest('hex').slice(0,12);
await writeFile('public/precache.js',`self.MAR_PRECACHE=${JSON.stringify({version,files})};`);
