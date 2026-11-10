import {createServerClient,parseCookieHeader,serializeCookieHeader} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {env} from 'cloudflare:workers';
const REMEMBER_COOKIE='mar-ia-remember';
const REMEMBER_MAX_AGE=30*24*60*60;
export function authConfigured(){return !!(env.SUPABASE_URL&&env.SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_')&&env.MAR_ADMIN_EMAIL);}
export async function serverAuth(){if(!authConfigured())return null;const url=new URL(env.SUPABASE_URL!);if(url.protocol!=='https:')throw Error('A autenticação exige HTTPS.');const store=await cookies(),remember=store.get(REMEMBER_COOKIE)?.value==='1';return createServerClient(env.SUPABASE_URL!,env.SUPABASE_PUBLISHABLE_KEY!,{cookieOptions:{name:'mar-supabase-auth',httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',...(remember?{maxAge:REMEMBER_MAX_AGE}:{})},cookies:{getAll:()=>store.getAll(),setAll(values){for(const {name,value,options}of values)store.set(name,value,options)}}});}

// Route handlers run on the worker adapter, so carry Supabase's cookie updates on the returned Response explicitly.
export function serverAuthForRequest(request:Request,rememberOverride?:boolean){
 if(!authConfigured())return null;
 const responseHeaders=new Headers(),setCookies=new Map<string,string>(),requestCookies=parseCookieHeader(request.headers.get('cookie')||''),remember=rememberOverride??requestCookies.some(cookie=>cookie.name===REMEMBER_COOKIE&&cookie.value==='1');
 const client=createServerClient(env.SUPABASE_URL!,env.SUPABASE_PUBLISHABLE_KEY!,{
  cookieOptions:{name:'mar-supabase-auth',httpOnly:true,sameSite:'lax',secure:new URL(request.url).protocol==='https:',path:'/',...(remember?{maxAge:REMEMBER_MAX_AGE}:{})},
  cookies:{
   getAll(){return requestCookies},
   setAll(values,cacheHeaders){
    for(const {name,value,options}of values)setCookies.set(name,serializeCookieHeader(name,value,options));
    for(const [name,value]of Object.entries(cacheHeaders||{}))responseHeaders.set(name,value);
   }
  }
 });
 return {client,responseHeaders,setCookies};
}
