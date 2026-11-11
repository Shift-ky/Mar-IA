import {currencies} from './exchange-rates';
export const wallets=['Dinheiro','Vale-alimentação','Vale-refeição','Combustível'] as const;
export type WalletName=typeof wallets[number];
const defaults:Record<string,any>={
 'Dinheiro':{type:'financeiro',currency:'BRL',showInPanel:true,showInFeira:true,showInRecurring:true,legacy:'dinheiro'},
 'Vale-alimentação':{type:'beneficio',currency:'BRL',showInPanel:true,showInFeira:true,showInRecurring:true,legacy:'alimentacao'},
 'Vale-refeição':{type:'beneficio',currency:'BRL',showInPanel:true,showInFeira:true,showInRecurring:true,legacy:'refeicao'},
 'Combustível':{type:'financeiro',currency:'BRL',showInPanel:true,showInFeira:false,showInRecurring:false,legacy:'gasolina'},
};
export function walletNames(records:any[]=[]):string[]{const deleted=new Set(records.filter(r=>r.kind==='walletDeleted').map(r=>r.name));return [...wallets.filter(name=>name==='Dinheiro'||!deleted.has(name)),...(records||[]).filter(r=>r.kind==='wallet'&&typeof r.name==='string').map(r=>r.name)].filter((name,index,list)=>list.indexOf(name)===index);}
export function walletDefinition(records:any[],name:string){const custom=(records||[]).find(r=>r.kind==='wallet'&&r.name===name);return custom?{type:'financeiro',currency:'BRL',showInPanel:true,showInFeira:false,showInRecurring:false,...custom}:defaults[name]||{type:'financeiro',currency:'BRL',showInPanel:true,showInFeira:false,showInRecurring:false};}
function linkedToGoal(records:any[],name:string){const definition=walletDefinition(records,name);return (records||[]).some(r=>r.kind==='goal'&&(r.walletId===definition.id||r.walletId===name||r.sourcePocketWalletId&&r.sourcePocketWalletId===definition.sourcePocketId||r.sourcePocketWalletName===name||Array.isArray(r.wallets)&&r.wallets.includes(name)));}
export function canTransferWallet(records:any[],name:string){const w=walletDefinition(records,name);return ['financeiro','poupanca'].includes(w.type)&&w.currency==='BRL'&&!linkedToGoal(records,name);}
export function canUseWallet(records:any[],name:string,where:'feira'|'recurring'){const w=walletDefinition(records,name);return w.currency==='BRL'&&!linkedToGoal(records,name)&&(where==='feira'?w.showInFeira===true&&w.legacy!=='gasolina':w.showInRecurring===true);}
export function walletsForTransfer(records:any[]=[]){return walletNames(records).filter(name=>canTransferWallet(records,name));}
export function walletsForAutomation(records:any[]=[],where:'feira'|'recurring'='feira'){return walletNames(records).filter(name=>canUseWallet(records,name,where));}
export function walletsForDisplay(records:any[]=[]){return walletNames(records).filter(name=>walletDefinition(records,name).showInPanel!==false);}
export function walletsForPanel(records:any[]=[]){return walletNames(records).filter(name=>walletDefinition(records,name).showInPanel!==false&&walletDefinition(records,name).currency==='BRL');}

export function validateWalletDefinition(raw:any){const name=String(raw?.name||'').trim(),type=String(raw?.type||'financeiro'),color=String(raw?.color||'#0ea5e9');if(!name||name.length>60)throw Error('Informe um nome de carteira com até 60 caracteres.');if(!['financeiro','beneficio','poupanca'].includes(type))throw Error('Tipo de carteira inválido.');if(!/^#[0-9a-f]{6}$/i.test(color))throw Error('Escolha uma cor válida.');const currency=String(raw?.currency||'BRL');if(!currencies.some(([code])=>code===currency))throw Error('Moeda inválida.');return {name,type,color:color.toLowerCase(),currency,showInPanel:raw?.showInPanel===true||raw?.showInPanel==='on',showInFeira:raw?.showInFeira===true||raw?.showInFeira==='on',showInRecurring:raw?.showInRecurring===true||raw?.showInRecurring==='on'};}
export function validateWalletMovement(raw:any,records:any[]=[]){const wallet=String(raw?.wallet||''),amount=Number(raw?.amount),date=String(raw?.date||''),name=String(raw?.name||'').trim(),direction=raw?.direction||'in';if(!walletNames(records).includes(wallet))throw Error('Selecione uma carteira válida.');if(!Number.isFinite(amount)||amount<=0)throw Error('Informe um valor positivo.');if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||isNaN(Date.parse(date)))throw Error('Informe uma data válida.');if(!name||name.length>120)throw Error('Informe uma descrição de até 120 caracteres.');if(!['in','out'].includes(direction))throw Error('Tipo de movimentação inválido.');return {name,amount,date,wallet,direction,currency:walletDefinition(records,wallet).currency};}
export function walletAmount(amount: number, sourceCurrency: string, definition: any) {
 const currency = definition.currency || 'BRL';
 if (sourceCurrency === currency) return amount;
 const rate = (code: string) => code === 'BRL' ? 1 : definition.balanceRates?.[code] || 1;
 return amount * rate(sourceCurrency) / rate(currency);
}
export function walletBalances(records: any[]) {
 const names = walletNames(records);
 const definitions = new Map(names.map(name => [name, walletDefinition(records, name)]));
 const balances: Record<string, number> = Object.fromEntries(names.map(name => [name, 0]));
 function add(name: string, amount: number, currency: string) {
  const definition = definitions.get(name);
  if (definition) balances[name] += walletAmount(amount, currency, definition);
 }
 for (const row of records) {
  const amount = Number(row.amount || 0);
  if (row.kind === 'walletMovement') {
   add(row.wallet, (row.direction === 'out' ? -1 : 1) * amount,
    row.currency || definitions.get(row.wallet)?.currency || 'BRL');
  }
  if (row.kind === 'walletTransfer' && row.paid !== false && !row.voided &&
      definitions.has(row.fromWallet) && definitions.has(row.toWallet)) {
   add(row.fromWallet, -amount, 'BRL');
   add(row.toWallet, amount, 'BRL');
  }
  if (row.kind === 'transaction' && row.paid && !row.voided) {
   const wallet = row.wallet || (row.paymentMethod === 'Pix' ? 'Dinheiro' : row.paymentMethod) ||
    (row.type === 'income' ? 'Dinheiro' : null);
   add(wallet, (row.type === 'income' ? 1 : -1) * amount, 'BRL');
  }
 }
 return balances;
}
export function validateWalletTransfer(raw:any,records:any[],excludeId?:string){const fromWallet=String(raw?.fromWallet||''),toWallet=String(raw?.toWallet||''),amount=Number(raw?.amount),date=String(raw?.date||'');if(!walletsForTransfer(records).includes(fromWallet)||!walletsForTransfer(records).includes(toWallet)||fromWallet===toWallet)throw Error('Transferências só podem usar carteiras financeiras ou poupanças em reais, sem meta vinculada.');if(!Number.isFinite(amount)||amount<=0||amount>1000000000||Math.abs(amount*100-Math.round(amount*100))>0.000001)throw Error('Informe um valor positivo com até duas casas decimais.');if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||isNaN(Date.parse(date))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw Error('Informe uma data válida.');if(Math.round(walletBalances(records.filter(r=>!excludeId||r.id!==excludeId))[fromWallet]*100)<Math.round(amount*100))throw Error('Saldo insuficiente na carteira de origem.');return {name:'Transferência entre carteiras',fromWallet,toWallet,amount,date,paid:true};}

