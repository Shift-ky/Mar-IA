 'use client';
import {useState} from 'react';
export default function PendingTransfers({snapshot,act}:{snapshot:any;act:(value:any)=>Promise<any>}){
 const [busy,B]=useState(false);
 const pending=(snapshot.records||[]).filter((r:any)=>r.kind==='walletTransfer'&&r.paid===false).sort((a:any,b:any)=>a.date.localeCompare(b.date));
 async function confirm(record:any){B(true);try{await act({action:'save',kind:'walletTransfer',id:record.id,data:{...record,paid:true}})}finally{B(false)}}
 return <section className="panel" aria-label="Transferências pendentes"><div className="sectiontitle"><div><h2>Transferências pendentes</h2><p>Confirme para transferir o valor entre as carteiras.</p></div><span className="badge pending">{pending.length}</span></div>{pending.map((r:any)=><article className="queueitem" key={r.id}><strong>{r.fromWallet} → {r.toWallet}</strong><p>{Number(r.amount).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} · {r.date.split('-').reverse().join('/')}</p><button className="primary" disabled={busy||!snapshot.permissions.edit} onClick={()=>void confirm(r)}>Confirmar transferência</button></article>)}{!pending.length&&<p className="muted">Nenhuma transferência pendente.</p>}</section>;
}
