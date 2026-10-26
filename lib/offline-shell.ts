export async function prepareOfflineShell(){
 if(!('serviceWorker' in navigator))throw Error('Este navegador não oferece instalação offline. Abra a Mar IA por HTTPS em um navegador compatível.');
 await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});
 const registration=await Promise.race([navigator.serviceWorker.ready,new Promise<never>((_,reject)=>setTimeout(()=>reject(Error('A preparação offline não terminou. Confira a conexão e tente novamente.')),25000))]);
 return new Promise<boolean>((resolve,reject)=>{const channel=new MessageChannel();const timer=setTimeout(()=>{channel.port1.close();reject(Error('Não foi possível verificar os arquivos offline. Tente preparar novamente.'))},8000);channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data?.ready===true)};if(!registration.active){clearTimeout(timer);reject(Error('O aplicativo offline ainda não está ativo.'));return;}registration.active.postMessage('READY',[channel.port2]);});
}
