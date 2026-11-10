import {walletNames,walletDefinition} from './wallets';
export function deleteWallet(records:any[],name:string,markerId:string,fxRate?:number){
 if(name==='Dinheiro')throw Error('A carteira Dinheiro não pode ser excluída.');
 if(!walletNames(records).includes(name))return records;
 const currency=walletDefinition(records,name).currency;const rate=currency==='BRL'?1:Number(fxRate);if(!Number.isFinite(rate)||rate<=0)throw Error('Uma cotação válida é necessária para mover o saldo para Dinheiro.');
 const definition=records.find(r=>r.kind==='wallet'&&r.name===name);
 const result=records.filter(r=>!(r.kind==='wallet'&&r.name===name)).map(record=>{
  const row={...record};let changed=false;
  for(const key of ['paymentMethod','wallet','fromWallet','toWallet','sourcePocketWalletName'])if(row[key]===name){row[key]='Dinheiro';changed=true;}
  if(row.kind==='feiraPurchase'&&(row.payment===name||name==='Vale-alimentação'&&row.payment==='Alimentação'||name==='Vale-refeição'&&row.payment==='Refeição')){row.payment='Dinheiro';changed=true;}
  if(row.kind==='goal'&&(record.sourcePocketWalletName===name||row.walletId===name||definition&&row.walletId===definition.id||definition?.sourcePocketId&&row.sourcePocketWalletId===definition.sourcePocketId)){row.walletId='Dinheiro';row.sourcePocketWalletName='Dinheiro';delete row.sourcePocketWalletId;changed=true;}
  if(row.kind==='goal'&&Array.isArray(row.wallets)&&row.wallets.includes(name)){row.wallets=[...new Set(row.wallets.map((wallet:string)=>wallet===name?'Dinheiro':wallet))];changed=true;}if(changed){if(currency!=='BRL'&&row.kind==='walletMovement'){row.originalCurrency=currency;row.originalAmount=row.amount;row.amount=Math.round(Number(row.amount)*rate*100)/100;row.currency='BRL';row.exchangeRate=rate;}row.movedFromWallet=row.movedFromWallet||name;if(row.fromWallet==='Dinheiro'&&row.toWallet==='Dinheiro'){if(row.kind==='recurringBill')row.disabled=true;else if(row.paid===false){row.paid=true;row.voided=true;}}}
  return row;
 });
 return [...result,{id:markerId,kind:'walletDeleted',name}];
}
