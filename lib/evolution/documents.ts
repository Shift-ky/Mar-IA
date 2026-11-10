import {digest} from '../whatsapp/crypto';
import {extractPdfReceipt,parsePdfFinancialText} from '../telegram/pdf-receipt';
const MAX_DOCUMENT_BYTES=20*1024*1024,MAX_BASE64_LENGTH=Math.ceil(MAX_DOCUMENT_BYTES/3)*4;
export async function storeDocument(env:Cloudflare.Env,a:any,attachment:any){
 if(!a.permissions.add||!env.BUCKET)throw Error('Sem acesso ao armazenamento de documentos.');
 if(typeof attachment?.base64!=='string'||attachment.base64.length>MAX_BASE64_LENGTH||!/^[-A-Za-z0-9+/=\r\n]+$/.test(attachment.base64))throw Error('Arquivo inválido ou maior que 20 MB.');
 const raw=atob(attachment.base64),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));if(bytes.length>MAX_DOCUMENT_BYTES)throw Error('Arquivo maior que 20 MB.');
 const mime=new TextDecoder().decode(bytes.slice(0,5))==='%PDF-'?'application/pdf':bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff?'image/jpeg':bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71?'image/png':null;
 if(!mime)throw Error('Envie somente JPEG, PNG ou PDF.');
 const hash=await digest(bytes.buffer),db=env.DB!,existing=await db.prepare("SELECT id FROM ev_documents WHERE family=? AND hash=? AND state<>'deleted'").bind(a.family,hash).first<any>();if(existing)return existing.id;
 const id='ev-doc-'+crypto.randomUUID(),storage='evolution/'+a.family+'/'+id;
 const extracted=mime==='application/pdf'?await extractPdfReceipt(bytes,true):typeof attachment.extractedText==='string'&&attachment.extractedText.length<=50000?parsePdfFinancialText(attachment.extractedText):{reason:'Confira o documento e preencha os dados. Não foi possível ler o texto da imagem automaticamente.'};
 await env.BUCKET.put(storage,bytes,{httpMetadata:{contentType:mime}});
 try{await db.prepare(`INSERT OR IGNORE INTO ev_documents SELECT ?,?,?,?,?,?,'needs_review',?,? WHERE EXISTS (SELECT 1 FROM families WHERE id=?) AND EXISTS (SELECT 1 FROM members WHERE family=? AND email=? AND (role='admin' OR json_extract(permissions,'$.add')=1))`).bind(id,a.family,a.user,hash,storage,mime,JSON.stringify(extracted),new Date().toISOString(),a.family,a.family,a.email).run();const saved=await db.prepare("SELECT id FROM ev_documents WHERE family=? AND hash=? AND state<>'deleted'").bind(a.family,hash).first<any>();if(saved?.id!==id)await env.BUCKET.delete(storage);if(!saved)throw Error('Acesso alterado.');return saved.id;}catch(e){await env.BUCKET.delete(storage);throw e;}
}
export async function purgeDocuments(env:Cloudflare.Env){if(!env.BUCKET)return;const rows=await env.DB!.prepare("SELECT id,storage FROM ev_documents WHERE state='deleted' LIMIT 10").all<any>();for(const row of rows.results){await env.BUCKET.delete(row.storage);await env.DB!.prepare("DELETE FROM ev_documents WHERE id=? AND state='deleted'").bind(row.id).run();}}
