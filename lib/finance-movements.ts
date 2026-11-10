// Presentation only: wallet movements do not become income/expense records.
export function confirmedFinanceRows(records:any[],month:string){
 return records.filter(r=>!r.voided&&r.date?.startsWith(month)&&(r.kind==='transaction'?r.paid:r.kind==='walletMovement'||r.kind==='walletTransfer'&&r.paid!==false)).map(r=>{
  if(r.kind==='walletMovement')return {...r,paid:true,type:r.direction==='out'?'expense':'income',category:r.direction==='out'?'Saída de saldo':'Entrada de saldo',paymentMethod:r.wallet};
  if(r.kind==='walletTransfer')return {...r,paid:true,type:'transfer',category:'Transferência entre carteiras',name:`${r.fromWallet} → ${r.toWallet}`};
  return r;
 });
}
