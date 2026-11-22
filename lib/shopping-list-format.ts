const unitLabels:Record<string,string>={un:'UN',kg:'KG',g:'G',l:'L',ml:'ML',pacote:'PACOTE',caixa:'CAIXA'};

export function formatShoppingListItem(name:string,quantity:number,unit:string,width=39){
 const itemName=String(name||'').trim().normalize('NFC').toLocaleUpperCase('pt-BR');
 const rawUnit=String(unit||'').trim();
 const label=unitLabels[rawUnit.toLowerCase()]||rawUnit.toLocaleUpperCase('pt-BR');
 const amount=[Number(quantity||0).toLocaleString('pt-BR',{maximumFractionDigits:3}),label].filter(Boolean).join(' ');
 const dots=Math.max(3,width-Array.from(itemName).length-Array.from(amount).length-1);
 return `${itemName}${'.'.repeat(dots)} ${amount}`;
}
