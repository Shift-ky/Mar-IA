import {serverAuth} from '../../../../lib/supabase/server';
import {headers} from 'next/headers';
export const dynamic='force-dynamic';
export async function POST(request:Request){if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Origem inválida.'},{status:403});const h=await headers();const hasPlatformLogin=!!h.get('oai-authenticated-user-id');const client=await serverAuth();if(client)await client.auth.signOut({scope:'local'});return Response.json({next:hasPlatformLogin?'/signout-with-chatgpt?return_to=/entrar':'/entrar'},{headers:{'Cache-Control':'private, no-store'}});}
