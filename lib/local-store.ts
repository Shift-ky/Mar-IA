let connection:Promise<IDBDatabase>|null=null;
function db(){
 if(!connection)connection=new Promise<IDBDatabase>((resolve,reject)=>{
  const request=indexedDB.open('mar-ia',1);
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('state'))request.result.createObjectStore('state')};
  request.onsuccess=()=>{const database=request.result;database.onversionchange=()=>{database.close();connection=null};database.onclose=()=>{connection=null};resolve(database)};
  request.onerror=()=>{connection=null;reject(Error('Não foi possível abrir o armazenamento local. Verifique se o navegador permite salvar dados.'))};
  request.onblocked=()=>{connection=null;reject(Error('Outro acesso está bloqueando o armazenamento local. Feche as outras abas e tente novamente.'))};
 });
 return connection;
}
function transaction(database:IDBDatabase,mode:IDBTransactionMode){if(mode==='readwrite'){try{return database.transaction('state',mode,{durability:'strict'})}catch{/* Older browsers still commit atomically without the optional durability hint. */}}return database.transaction('state',mode);}
export async function read(key:string):Promise<any>{const database=await db();return new Promise((resolve,reject)=>{const tx=transaction(database,'readonly');const request=tx.objectStore('state').get(key);let value:any;request.onsuccess=()=>{value=request.result};tx.oncomplete=()=>resolve(value);tx.onerror=tx.onabort=()=>reject(tx.error||Error('Não foi possível ler os dados deste aparelho.'));});}
export async function write(key:string,fn:(v:any)=>any){const database=await db();return new Promise<any>((resolve,reject)=>{const tx=transaction(database,'readwrite');const store=tx.objectStore('state');let value:any;const request=store.get(key);request.onsuccess=()=>{try{value=fn(request.result);store.put(value,key)}catch(e){tx.abort();reject(e)}};tx.oncomplete=()=>{window.dispatchEvent(new Event('mar-local-change'));resolve(value)};tx.onerror=()=>reject(Error('Não foi possível salvar no dispositivo. Libere espaço antes de tentar novamente.'));tx.onabort=()=>reject(Error('O salvamento local foi interrompido.'));});}
export async function clearAccount(account:string){const database=await db();await new Promise<void>((resolve,reject)=>{const tx=transaction(database,'readwrite');tx.objectStore('state').delete('user:'+account);tx.objectStore('state').delete('active');tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(tx.error)});}
