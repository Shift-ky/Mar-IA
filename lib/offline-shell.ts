import {APP_RELEASE} from './app-release';
export type ShellState={ready:boolean;version?:string;release?:string;missing?:string[]};
let preparing:Promise<boolean>|null=null;
let updateCheck:Promise<boolean>|null=null;
let lastUpdateCheck=0;
function bounded<T>(promise:Promise<T>,ms:number,message:string){let timer:ReturnType<typeof setTimeout>;return Promise.race([promise,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),ms)})]).finally(()=>clearTimeout(timer));}
function inspect(worker:ServiceWorker){return bounded(new Promise<ShellState>((resolve,reject)=>{const channel=new MessageChannel();const finish=(value?:ShellState,error?:Error)=>{channel.port1.close();error?reject(error):resolve(value||{ready:false})};channel.port1.onmessage=e=>finish(e.data);channel.port1.onmessageerror=()=>finish(undefined,Error('Não foi possível verificar o cache do aplicativo.'));worker.postMessage('READY',[channel.port2]);}),8000,'Não foi possível verificar os arquivos offline. Tente novamente.');}
async function waitActivated(worker:ServiceWorker){await bounded(new Promise<void>((resolve,reject)=>{const check=()=>{if(worker.state==='activated'){worker.removeEventListener('statechange',check);resolve()}else if(worker.state==='redundant'){worker.removeEventListener('statechange',check);reject(Error('Não foi possível baixar todos os arquivos da atualização. A versão anterior e seus dados foram preservados.'));}};worker.addEventListener('statechange',check);check();}),45000,'A atualização não terminou. Confira a conexão e tente novamente.');}
async function prepare(){
 if(!('serviceWorker' in navigator))throw Error('Este navegador não oferece instalação offline. Abra a Mar IA por HTTPS em um navegador compatível.');
 const sw=navigator.serviceWorker,previous=await sw.getRegistration('/');
 if(!navigator.onLine){if(previous?.active)return (await inspect(previous.active)).ready;throw Error('Conecte este aparelho uma vez para preparar os arquivos offline. Os dados locais foram preservados.');}
 const registration=await bounded(sw.register('/sw.js',{scope:'/',updateViaCache:'none'}),25000,'A hospedagem não concluiu o registro offline. Confira a conexão e tente novamente.');
 await bounded(registration.update(),25000,'Não foi possível verificar a nova versão. Tente novamente com internet.');
 const pending=registration.installing||registration.waiting;
 if(pending)await waitActivated(pending);
 const ready=await bounded(sw.ready,10000,'O aplicativo offline ainda não foi ativado pela hospedagem.');
 const active=registration.active||ready.active;if(!active)throw Error('O aplicativo offline ainda não está ativo.');
 return (await inspect(active)).ready;
}
export function prepareOfflineShell(){if(!preparing)preparing=prepare().finally(()=>{preparing=null});return preparing;}
export async function appUpdateStatus(){const active=(await navigator.serviceWorker?.getRegistration('/'))?.active;if(!active)return {ready:false,update:false};const state=await inspect(active);return {...state,update:state.ready&&!!state.release&&state.release!==APP_RELEASE};}
export function checkForPwaUpdate(){if(!('serviceWorker'in navigator)||!navigator.onLine)return Promise.resolve(false);if(updateCheck)return updateCheck;if(Date.now()-lastUpdateCheck<5*60*1000)return appUpdateStatus().then(state=>state.update);lastUpdateCheck=Date.now();updateCheck=(async()=>{const registration=await navigator.serviceWorker.getRegistration('/');if(!registration)return false;await bounded(registration.update(),25000,'Não foi possível sincronizar a atualização do aplicativo.');const state=await appUpdateStatus();return state.update})().finally(()=>{updateCheck=null});return updateCheck;}
export function watchAppUpdates(onUpdate:()=>void){
 if(!('serviceWorker' in navigator))return ()=>{};
 let alive=true;const check=()=>{void appUpdateStatus().then(s=>{if(alive&&s.update)onUpdate()}).catch(()=>{});};
 const syncCheck=()=>{if(document.visibilityState==='visible')void checkForPwaUpdate().then(update=>{if(alive&&update)onUpdate()}).catch(()=>{});};
 const timer=window.setInterval(syncCheck,5*60*1000);window.addEventListener('online',syncCheck);document.addEventListener('visibilitychange',syncCheck);
 navigator.serviceWorker.addEventListener('controllerchange',check);navigator.serviceWorker.addEventListener('message',check);syncCheck();
 return ()=>{alive=false;window.clearInterval(timer);window.removeEventListener('online',syncCheck);document.removeEventListener('visibilitychange',syncCheck);navigator.serviceWorker.removeEventListener('controllerchange',check);navigator.serviceWorker.removeEventListener('message',check);};
}
