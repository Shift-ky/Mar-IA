export function receiptDeletionPlan(records:any[],documentId:string){
 const linked=records.filter(r=>r.receiptId===documentId&&['transaction','purchaseItem','stockMovement'].includes(r.kind));
 const removed=new Set(linked.map(r=>r.id));
 const remaining=records.filter(r=>!removed.has(r.id));
 return {records:remaining,removedIds:[...removed]};
}

// Keep only a retry marker until the private file has actually been deleted.
export async function purgeDeletedDocuments(env:{DB?:any,BUCKET?:any}){
 if(!env.DB||!env.BUCKET?.delete)return;
 const docs=await env.DB.prepare("SELECT id,storage FROM wa_documents WHERE state='deleted' LIMIT 10").all();
 for(const doc of docs.results)try{
  if(doc.storage)await env.BUCKET.delete(doc.storage);
  await env.DB.prepare("DELETE FROM wa_documents WHERE id=? AND state='deleted' AND storage=?").bind(doc.id,doc.storage).run();
 }catch{/* A failed file deletion remains queued for the next cleanup attempt. */}
}
