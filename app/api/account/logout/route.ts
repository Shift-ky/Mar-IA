import {headers} from 'next/headers';
import {serverAuthForRequest} from '../../../../lib/supabase/server';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Origem inválida.'},{status:403});
 const h=await headers(),hasPlatformLogin=!!h.get('oai-authenticated-user-id'),auth=serverAuthForRequest(request);
 if(auth)await auth.client.auth.signOut({scope:'local'});
 const response=Response.json({next:hasPlatformLogin?'/signout-with-chatgpt?return_to=/entrar':'/entrar'},{headers:{'Cache-Control':'private, no-store'}});
 if(auth){for(const cookie of auth.setCookies.values())response.headers.append('Set-Cookie',cookie);auth.responseHeaders.forEach((value,name)=>{if(name.toLowerCase()!=='set-cookie')response.headers.set(name,value)});}
 return response;
}
