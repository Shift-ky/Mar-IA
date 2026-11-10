import {inventory,normalize} from './inventory';
import {walletsForAutomation} from './wallets';
export const feiraPayments=['Não lançar','Dinheiro','Alimentação','Refeição'] as const;
export function feiraPaymentsFor(records:any[]){const names=walletsForAutomation(records,'feira').map(name=>name==='Vale-alimentação'?'Alimentação':name==='Vale-refeição'?'Refeição':name);return [...new Set(['Não lançar',...names])];}
const round=(v:number)=>Math.round(v*1000)/1000;
const cents=(v:number)=>Math.round(v*100)/100;
export const stockKinds=['product','productGroup','stockMovement','purchaseItem','feiraPurchase'];
export function stockAccess(s:any){return !!(s.admin||(s.permissions?.view&&s.permissions?.stock!==false));}
export function feiraList(records:any[]){
 const products=inventory(records),manual=records.filter(r=>r.kind==='shoppingItem'&&!r.autoStock);
 const auto=products.filter(p=>p.missing>0).map(p=>{const id='replenish-'+p.id,stored=records.find(r=>r.id===id&&r.kind==='shoppingItem');return {...stored,id,kind:'shoppingItem',name:p.name,unit:p.unit,quantity:p.missing,productId:p.id,autoStock:true,bought:stored?.bought===true,order:stored?.order,purchasedQuantity:stored?.bought?Number(stored.purchasedQuantity??p.missing):0,unitPrice:Number(stored?.unitPrice??p.lastUnitPrice??0)};});
 const list=[...manual.map(r=>({...r,unitPrice:Number(r.unitPrice??products.find(p=>p.id===r.productId||normalize(p.name)===normalize(r.name)&&p.unit===r.unit)?.lastUnitPrice??0),purchasedQuantity:r.bought?Number(r.purchasedQuantity??r.quantity):0})),...auto];
 return list.map((item,index)=>({...item,order:Number.isSafeInteger(item.order)?item.order:index})).sort((a,b)=>Number(a.order)-Number(b.order)||a.name.localeCompare(b.name,'pt-BR'));
}
export function mergeFeira(records:any[]){return [...records.filter(r=>r.kind!=='shoppingItem'),...feiraList(records)];}
export function feiraPlan(records:any[],b:any){
 const rows:any[]=[],remove:string[]=[];const put=(id:string,kind:string,data:any)=>rows.push({id,kind,data:{...data,feiraOperation:b.operationId}});
 if(b.action==='feiraItem'){
  const item=feiraList(records).find(r=>r.id===b.id);if(!item)throw Error('Item removido ou reposição já atendida. Atualize a Feira.');
  const quantity=Number(b.data?.purchasedQuantity??item.purchasedQuantity),price=Number(b.data?.unitPrice??item.unitPrice);
  if(!Number.isFinite(quantity)||quantity<0||quantity>100000||!Number.isFinite(price)||price<0||price>1000000)throw Error('Quantidade comprada ou preço inválido.');
  const order=Number(b.data?.order??item.order??0);if(!Number.isSafeInteger(order)||order<0||order>100000)throw Error('Posição da Feira inválida.');put(item.id,'shoppingItem',{name:item.name,quantity:item.quantity,unit:item.unit,productId:item.productId||'',autoStock:!!item.autoStock,bought:b.data?.bought??item.bought,order,purchasedQuantity:round(quantity),unitPrice:cents(price)});
 }else if(b.action==='stockOrder'){
  if(!Array.isArray(b.ids)||b.ids.length>500)throw Error('Ordem inválida.');
  b.ids.forEach((id:string,order:number)=>{const p=records.find(r=>r.id===id&&r.kind==='product');if(!p)throw Error('Produto não encontrado.');const {id:_,kind,author,family,local,...data}=p;put(id,'product',{...data,order});});
 }else if(b.action==='feiraCopy'){
  const purchase=records.find(r=>r.id===b.id&&r.kind==='feiraPurchase');if(!purchase)throw Error('Compra não encontrada.');
  const copied:any[]=[];for(const line of purchase.items){const existing=copied.find(r=>normalize(r.name)===normalize(line.name)&&r.unit===line.unit);if(existing)existing.quantity=round(existing.quantity+line.quantity);else copied.push({...line});}
  copied.forEach((item:any,i:number)=>{const product=inventory(records).find(p=>p.id===item.productId||normalize(p.name)===normalize(item.name)&&p.unit===item.unit);const current=feiraList([...records,...rows.map(r=>({...r.data,id:r.id,kind:r.kind}))]).find(r=>!r.autoStock&&normalize(r.name)===normalize(item.name)&&r.unit===item.unit);put(current?.id||b.entityId+'-'+i,'shoppingItem',{name:item.name,unit:item.unit,quantity:item.quantity,productId:product?.id||'',unitPrice:product?.lastUnitPrice??item.unitPrice,bought:false,purchasedQuantity:0});});
 }else if(['feiraSave','feiraDelete'].includes(b.action)){
  const old=b.id?records.find(r=>r.id===b.id&&r.kind==='feiraPurchase'):null;if(b.id&&!old)throw Error('Compra removida em outro dispositivo.');
  const id=b.id||b.entityId;if(!b.id&&records.some(r=>r.id===id))throw Error('Esta compra já existe. Atualize a Feira.');if(!id)throw Error('Identificador inválido.');
  const without=records.filter(r=>r.id!==id&&r.purchaseId!==id);const original=inventory(records);
  let items:any[]=[],payment='Não lançar',date='',total=0;
  if(b.action==='feiraSave'){
   payment=b.data?.payment;date=String(b.data?.date||'');
   if(!feiraPaymentsFor(records).includes(payment)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||isNaN(Date.parse(date))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw Error('Escolha uma carteira habilitada para a Feira e informe uma data válida.');
   if(!Array.isArray(b.data?.items)||!b.data.items.length||b.data.items.length>100)throw Error('Selecione de 1 a 100 itens.');
   items=b.data.items.map((raw:any,i:number)=>{const name=String(raw.name||'').trim(),quantity=Number(raw.quantity),unitPrice=Number(raw.unitPrice),unit=raw.unit;
    if(!name||name.length>100||!['un','kg','g','l','ml','pacote','caixa'].includes(unit)||!Number.isFinite(quantity)||quantity<=0||quantity>100000||!Number.isFinite(unitPrice)||unitPrice<0||unitPrice>1000000)throw Error('Confira nome, quantidade, unidade e preço de cada item.');
    let product=without.find(r=>r.kind==='product'&&(raw.productId?r.id===raw.productId:normalize(r.name)===normalize(name)&&r.unit===unit));
    if(raw.productId&&(!product||product.unit!==unit))throw Error('Produto não encontrado nesta família ou unidade incompatível.');
    if(payment!=='Não lançar'&&!product){product={id:'fp-'+id+'-'+i,kind:'product',name,unit,initial:0,minimum:round(quantity),groupId:'',aliases:[],order:without.length+i};without.push(product);const {id:pid,kind,...data}=product;put(pid,kind,data);}
    return {name,unit,quantity:round(quantity),unitPrice:cents(unitPrice),productId:product?.id||'',shoppingId:String(raw.shoppingId||'')};
   });
   total=cents(items.reduce((a,r)=>a+cents(r.quantity*r.unitPrice),0));if(payment!=='Não lançar'&&total<=0)throw Error('Informe os preços reais antes de lançar a compra nas Finanças.');
   if(payment!=='Não lançar')for(const shoppingId of new Set(items.map(r=>r.shoppingId).filter(id=>id&&!id.startsWith('replenish-')))){
    const source=records.find(r=>r.id===shoppingId&&r.kind==='shoppingItem');if(!source)continue;
    const lines=items.filter(r=>r.shoppingId===shoppingId);
    if(lines.some(r=>normalize(source.name)!==normalize(r.name)||source.unit!==r.unit))throw Error('Item da Feira mudou. Atualize antes de finalizar.');
    const previous=old?.finalized?old.items.filter((r:any)=>r.shoppingId===shoppingId).reduce((a:number,r:any)=>a+r.quantity,0):0;
    const delta=lines.reduce((a,r)=>a+r.quantity,0)-previous;
    const remaining=round(source.quantity-delta);remove.push(source.id);if(remaining>0)put(source.id,'shoppingItem',{name:source.name,quantity:remaining,unit:source.unit,productId:lines[0].productId,unitPrice:lines[0].unitPrice,bought:false,purchasedQuantity:0});
   }
   const saved={name:'Compra da Feira',date,payment,total,items,createdAt:old?.createdAt||b.createdAt||new Date().toISOString(),updatedAt:b.createdAt||new Date().toISOString(),finalized:payment!=='Não lançar'};put(id,'feiraPurchase',saved);
   if(payment!=='Não lançar'){
    for(const item of items)remove.push('replenish-'+item.productId);
    const method=payment==='Alimentação'?'Vale-alimentação':payment==='Refeição'?'Vale-refeição':payment;
    put('ft-'+id,'transaction',{name:'Feira · '+items.length+' item(ns)',date,amount:total,type:'expense',paid:true,category:'Supermercado',paymentMethod:method,purchaseId:id,source:'feira'});
    items.forEach((r,i)=>{put('fm-'+id+'-'+i,'stockMovement',{name:'Compra: '+r.name,productId:r.productId,delta:r.quantity,date,purchaseId:id});put('fi-'+id+'-'+i,'purchaseItem',{...r,date,purchaseId:id,purchasedAt:saved.updatedAt});});
   }
  }
  if(old){remove.push(old.id,...records.filter(r=>r.purchaseId===old.id).map(r=>r.id));}
  const final=without.filter(r=>!remove.includes(r.id));for(const row of rows){const index=final.findIndex(r=>r.id===row.id);if(index>=0)final.splice(index,1);final.push({...row.data,id:row.id,kind:row.kind});}
  for(const p of inventory(final)){if(p.quantity<-.00001&&p.quantity<(original.find(r=>r.id===p.id)?.quantity??0))throw Error('A correção deixaria '+p.name+' com estoque negativo. Ajuste o estoque antes de editar ou excluir esta compra.');}
 }else throw Error('Operação de Feira inválida.');
 return {rows,remove:[...new Set(remove)]};
}
export function applyFeira(records:any[],plan:any,author=''){const next=records.filter(r=>!plan.remove.includes(r.id)&&!plan.rows.some((x:any)=>x.id===r.id));return mergeFeira([...next,...plan.rows.map((r:any)=>({...r.data,id:r.id,kind:r.kind,author,local:true}))]);}
