import {env} from 'cloudflare:workers';
import {phoneActor} from '../../../../lib/whatsapp/access';
import {familyRecords} from '../../../../lib/inventory';
export async function POST(req:Request){
 try{
 const body:any=await req.json();if(typeof body.initData!=='string'||body.initData.length>10000)throw Error();
 const params=new URLSearchParams(body.initData),hash=params.get('hash');params.delete('hash');
 const date=Number(params.get('auth_date'));if(!date||Math.abs(Date.now()/1000-date)>300)throw Error();
 const hmac=async(key:Uint8Array,text:string)=>new Uint8Array(await crypto.subtle.sign('HMAC',await crypto.subtle.importKey('raw',key as BufferSource,{name:'HMAC',hash:'SHA-256'},false,['sign']),new TextEncoder().encode(text)));
 const secret=await hmac(new TextEncoder().encode('WebAppData'),env.TELEGRAM_BOT_TOKEN!);
 const check=[...params.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');
 const actual=[...await hmac(secret,check)].map(v=>v.toString(16).padStart(2,'0')).join('');
 if(!hash||hash.length!==actual.length||![...actual].reduce((ok,c,i)=>ok&(c===hash[i]?1:0),1))throw Error();
 const user=JSON.parse(params.get('user')||'{}');if(!Number.isSafeInteger(user.id))throw Error();
 const a=await phoneActor(env.DB!,'tg:'+user.id);if(!a.permissions.view)throw Error();
 const rows=await familyRecords(env.DB!,a.family);
 return Response.json({familyName:a.familyName,records:rows.filter((r:any)=>['transaction','walletMovement'].includes(r.kind)).map((r:any)=>({kind:r.kind,date:r.date,name:r.name,type:r.type,amount:r.amount,paid:r.paid,voided:r.voided,paymentMethod:r.paymentMethod,wallet:r.wallet,direction:r.direction}))},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Acesso expirado ou não autorizado. Abra novamente pelo bot.'},{status:403,headers:{'Cache-Control':'no-store'}});}
}
