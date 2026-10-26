let preparing:Promise<boolean>|null=null;
function bounded<T>(promise:Promise<T>,ms:number,message:string){let timer:ReturnType<typeof setTimeout>;return Promise.race([promise,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),ms)})]).finally(()=>clearTimeout(timer));}
function inspect(worker:ServiceWorker){return bounded(new Promise<boolean>((resolve,reject)=>{const channel=new MessageChannel();const finish=(value?:boolean,error?:Error)=>{channel.port1.close();error?reject(error):resolve(!!value)};channel.port1.onmessage=e=>finish(e.data?.ready===true);channel.port1.onmessageerror=()=>finish(false,Error('Não foi possível verificar o cache do aplicativo.'));worker.postMessage('READY',[channel.port2]);}),8000,'Não foi possível verificar os arquivos offline. Tente preparar novamente.');}
async function prepare(){
 if(!('serviceWorker' in navigator))throw Error('Este navegador não oferece instalação offline. Abra a Mar IA por HTTPS em um navegador compatível.');
 const sw=navigator.serviceWorker;
 const previous=await sw.getRegistration('/');
 if(!navigator.onLine){if(previous?.active)return inspect(previous.active);throw Error('Conecte este aparelho uma vez para preparar os arquivos offline. Os dados locais foram preservados.');}
 const registration=await bounded(sw.register('/sw.js',{scope:'/',updateViaCache:'none'}),25000,'A hospedagem não concluiu o registro offline. Confira a conexão e tente novamente.');
 const installing=registration.installing;
 if(installing)await bounded(new Promise<void>((resolve,reject)=>{const check=()=>{if(installing.state==='activated'){installing.removeEventListener('statechange',check);resolve()}else if(installing.state==='redundant'){installing.removeEventListener('statechange',check);reject(Error('Não foi possível baixar todos os arquivos offline. Tente novamente com internet.'));}};installing.addEventListener('statechange',check);check();}),30000,'A preparação offline não terminou. Confira a conexão e tente novamente.');
 const ready=await bounded(sw.ready,10000,'O aplicativo offline ainda não foi ativado pela hospedagem.');
 if(!ready.active)throw Error('O aplicativo offline ainda não está ativo.');
 return inspect(ready.active);
}
export function prepareOfflineShell(){if(!preparing)preparing=prepare().finally(()=>{preparing=null});return preparing;}
