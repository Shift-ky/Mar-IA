import {boundedBody} from '../../../lib/whatsapp/crypto';
import {serverAuthForRequest,authConfigured} from '../../../lib/supabase/server';
import {profileFields} from '../../../lib/profile';
import {env} from 'cloudflare:workers';
export const dynamic='force-dynamic';
function json(value:any,status=200){return Response.json(value,{status,headers:{'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache','Expires':'0'}})}
function withAuthHeaders(response:Response,headers?:Headers,cookies?:Map<string,string>){
 for(const cookie of cookies?.values()||[])response.headers.append('Set-Cookie',cookie);
 headers?.forEach((value,name)=>{if(name.toLowerCase()!=='set-cookie')response.headers.set(name,value)});
 return response;
}
export async function GET(){const enabled=authConfigured();if(!enabled)return json({enabled:false,googleEnabled:false});try{const response=await fetch(new URL('/auth/v1/settings',env.SUPABASE_URL!),{headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY!},cache:'no-store'});const settings:any=response.ok?await response.json():null;return json({enabled,googleEnabled:settings?.external?.google===true});}catch{return json({enabled,googleEnabled:false});}}
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Origem não autorizada.'},403);
 if(Number(request.headers.get('content-length')||0)>8192)return json({error:'Solicitação inválida.'},413);
 let responseHeaders:Headers|undefined,setCookies:Map<string,string>|undefined;
 const done=(value:any,status=200)=>withAuthHeaders(json(value,status),responseHeaders,setCookies);
 try{
  if(!authConfigured())return done({error:'O cadastro por e-mail ainda não está disponível. Seu acesso atual foi mantido.'},503);
  const auth=serverAuthForRequest(request);if(!auth)return done({error:'A autenticação ainda não está configurada.'},503);
  responseHeaders=auth.responseHeaders;setCookies=auth.setCookies;
  const client=auth.client,b:any=JSON.parse(await boundedBody(request,8192));
  const email=String(b.email||'').trim().toLowerCase();
  if(['signup','login','recover','resend'].includes(b.action)&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return done({error:'Informe um e-mail válido.'},400);
  if(['signup','login','password'].includes(b.action)&&(typeof b.password!=='string'||b.password.length>128||b.password.length<(b.action==='login'?1:12)))return done({error:'Use uma senha com pelo menos 12 caracteres.'},400);
  if(b.action==='google'){
   const {data,error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:new URL('/auth/callback?next=/',request.url).href,queryParams:{prompt:'select_account'},skipBrowserRedirect:true}});
   if(error||!data.url)return done({error:'Não foi possível iniciar o acesso pelo Google. Confira se o Google está habilitado no provedor de autenticação.'},400);
   return done({url:data.url});
  }
  if(b.action==='signup'){
   const fields=profileFields(b);const {error}=await client.auth.signUp({email,password:b.password,options:{data:{name:fields.name,phone:fields.phone},emailRedirectTo:new URL('/auth/callback',request.url).href}});
   if(error)return done({error:'Não foi possível concluir o cadastro. Tente novamente em alguns minutos.'},400);
   return done({message:'Confira seu e-mail e abra o link de confirmação. Se já tiver cadastro, entre ou recupere sua senha.'});
  }
  if(b.action==='login'){
   const {data,error}=await client.auth.signInWithPassword({email,password:b.password});
   if(error||!data.user?.email_confirmed_at){if(!error)await client.auth.signOut({scope:'local'});return done({error:'Não foi possível entrar. Confira seus dados e a confirmação do e-mail.'},400);}
   return done({next:'/'});
  }
  if(b.action==='recover'){
   const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:new URL('/auth/callback?next=/nova-senha',request.url).href});
   if(error)return done({error:'Não foi possível enviar agora. Aguarde alguns minutos e tente novamente.'},429);
   return done({message:'Se houver uma conta com esse e-mail, enviaremos um link para redefinir a senha.'});
  }
  if(b.action==='resend'){
   const {error}=await client.auth.resend({type:'signup',email,options:{emailRedirectTo:new URL('/auth/callback',request.url).href}});
   if(error)return done({error:'Aguarde alguns minutos antes de pedir outro link.'},429);
   return done({message:'Se o cadastro estiver aguardando confirmação, você receberá outro link por e-mail.'});
  }
  if(b.action==='password'){
   const {data,error}=await client.auth.getUser();
   if(error||!data.user?.email_confirmed_at)return done({error:'O link expirou ou a sessão não é válida. Solicite uma nova recuperação.'},401);
   const updated=await client.auth.updateUser({password:b.password});
   if(updated.error)return done({error:'Não foi possível atualizar a senha. Solicite outro link e tente novamente.'},400);
   await client.auth.signOut({scope:'global'});
   return done({message:'Senha atualizada. Entre novamente com a nova senha.',next:'/entrar'});
  }
  return done({error:'Ação inválida.'},400);
 }catch{return done({error:'Não foi possível concluir a solicitação. Tente novamente.'},400);}
}
