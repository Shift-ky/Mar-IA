import {serverAuthForRequest} from '../../../lib/supabase/server';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const url=new URL(request.url),code=url.searchParams.get('code');
 let target=url.searchParams.has('error')||url.searchParams.has('error_description')?'/entrar?erro=google':'/entrar?erro=link';
 const auth=serverAuthForRequest(request),headers=new Headers({'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'});
 try{if(code&&auth){const {error}=await auth.client.auth.exchangeCodeForSession(code);if(!error)target=url.searchParams.get('next')==='/nova-senha'?'/nova-senha':'/';else target='/entrar?erro=google';}}catch{if(code)target='/entrar?erro=google';}
 if(auth){for(const cookie of auth.setCookies.values())headers.append('Set-Cookie',cookie);auth.responseHeaders.forEach((value,name)=>{if(name.toLowerCase()!=='set-cookie')headers.set(name,value)});}
 headers.set('Location',new URL(target,url.origin).href);
 return new Response(null,{status:303,headers});
}
