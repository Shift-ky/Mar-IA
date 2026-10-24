import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {env} from 'cloudflare:workers';
export function authConfigured(){return !!(env.SUPABASE_URL&&env.SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_')&&env.MAR_ADMIN_EMAIL);}
export async function serverAuth(){if(!authConfigured())return null;const url=new URL(env.SUPABASE_URL!);if(url.protocol!=='https:')throw Error('A autenticação exige HTTPS.');const store=await cookies();return createServerClient(env.SUPABASE_URL!,env.SUPABASE_PUBLISHABLE_KEY!,{cookieOptions:{name:'mar-supabase-auth',httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/'},cookies:{getAll:()=>store.getAll(),setAll(values){for(const {name,value,options}of values)store.set(name,value,options)}}});}
