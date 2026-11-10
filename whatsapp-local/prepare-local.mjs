// Receives generated secrets through hidden stdin, never command-line arguments.
import {writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
const destination=process.platform==='win32'?join(process.env.LOCALAPPDATA,'MarIA','WhatsApp','config.env'):fileURLToPath(new URL('.env',import.meta.url));
mkdirSync(dirname(destination),{recursive:true});
if(existsSync(destination))throw Error('A configuração local já existe; não será substituída.');
process.stdout.write('Aguardando configuração segura (entrada oculta).\n');
if(process.stdin.isTTY)process.stdin.setRawMode(true);process.stdin.resume();let input='';
process.stdin.on('data',chunk=>{input+=chunk.toString();if(!/[\r\n]/.test(input))return;try{
 const data=JSON.parse(input.trim()),keys=['EVOLUTION_API_KEY','EVOLUTION_BRIDGE_SECRET','EVOLUTION_LOCAL_SECRET','POSTGRES_PASSWORD'];
 for(const key of keys)if(!/^[a-f0-9]{64}$/.test(data[key]||''))throw Error('Configuração inválida.');
 const site=new URL(data.MAR_SITE_URL);if(site.protocol!=='https:')throw Error('Endereço inválido.');
 writeFileSync(destination,['MAR_SITE_URL='+site.origin,'EVOLUTION_INSTANCE=mar-ia',...keys.map(k=>k+'='+data[k])].join('\n')+'\n',{mode:0o600,flag:'wx'});
 if(process.platform==='win32'){const result=spawnSync('icacls',[destination,'/inheritance:r','/grant:r',process.env.USERNAME+':(F)'],{stdio:'ignore'});if(result.status)throw Error('Não foi possível restringir a configuração local.');}
 process.stdout.write('Configuração local preparada e protegida.\n');process.exit(0);
 }catch{process.stderr.write('Falha ao preparar a configuração local.\n');process.exit(1)}});
