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
export function walletDefinition(records:any[],name:string){const custom=(records||[]).find(r=>r.kind==='wallet'&&r.name===name),fallback=defaults[name]||{type:'financeiro',currency:'BRL',showInPanel:true,showInFeira:false,showInRecurring:false};return custom?{...fallback,...custom}:fallback;}
function linkedToGoal(records:any[],name:string){const definition=walletDefinition(records,name);return (records||[]).some(r=>r.kind==='goal'&&(r.walletId===definition.id||r.walletId===name||r.sourcePocketWalletId&&r.sourcePocketWalletId===definition.sourcePocketId||r.sourcePocketWalletName===name||Array.isArray(r.wallets)&&r.wallets.includes(name)));}
export function canTransferWallet(records:any[],name:string){const w=walletDefinition(records,name);return w.allowTransfers!==false&&['financeiro','poupanca'].includes(w.type)&&w.currency==='BRL'&&!linkedToGoal(records,name);}
export function canUseWallet(records:any[],name:string,where:'feira'|'recurring'){const w=walletDefinition(records,name);if(where==='recurring'&&name==='Dinheiro')return w.currency==='BRL';return w.currency==='BRL'&&!linkedToGoal(records,name)&&(where==='feira'?w.showInFeira===true&&w.legacy!=='gasolina':w.type!=='credito'&&w.showInRecurring===true);}
export function walletsForTransfer(records:any[]=[]){return walletNames(records).filter(name=>canTransferWallet(records,name));}
export function walletsForAutomation(records:any[]=[],where:'feira'|'recurring'='feira'){return walletNames(records).filter(name=>canUseWallet(records,name,where));}
export function walletsForDisplay(records:any[]=[]){return walletNames(records).filter(name=>walletDefinition(records,name).showInPanel!==false);}
export function walletsForPanel(records:any[]=[]){return walletNames(records).filter(name=>walletDefinition(records,name).showInPanel!==false&&walletDefinition(records,name).currency==='BRL'&&walletDefinition(records,name).type!=='credito');}

export function validateWalletDefinition(raw:any){const name=String(raw?.name||'').trim(),type=String(raw?.type||'financeiro'),color=String(raw?.color||'#0ea5e9');if(!name||name.length>60)throw Error('Informe um nome de carteira com até 60 caracteres.');if(!['financeiro','beneficio','poupanca','credito'].includes(type))throw Error('Tipo de carteira inválido.');if(!/^#[0-9a-f]{6}$/i.test(color))throw Error('Escolha uma cor válida.');const credit=type==='credito',creditLimit=Number(raw?.creditLimit);if(credit&&(!Number.isFinite(creditLimit)||creditLimit<=0||creditLimit>1e9||Math.abs(creditLimit*100-Math.round(creditLimit*100))>1e-5))throw Error('Informe um limite positivo com até duas casas decimais.');const currency=credit?'BRL':String(raw?.currency||'BRL');if(!currencies.some(([code])=>code===currency))throw Error('Moeda inválida.');return {name,type,color:color.toLowerCase(),currency,...(credit?{creditLimit}:{}),allowTransfers:raw?.allowTransfers!==false,showInPanel:raw?.showInPanel===true||raw?.showInPanel==='on',showInFeira:(raw?.showInFeira===true||raw?.showInFeira==='on'),showInRecurring:!credit&&(raw?.showInRecurring===true||raw?.showInRecurring==='on')};}
export function validateWalletMovement(raw:any,records:any[]=[]){const wallet=String(raw?.wallet||''),amount=Number(raw?.amount),date=String(raw?.date||''),name=String(raw?.name||'').trim(),direction=raw?.direction||'in';if(!walletNames(records).includes(wallet))throw Error('Selecione uma carteira válida.');if(walletDefinition(records,wallet).type==='credito')throw Error('Registre uma despesa ou pague uma pendência para movimentar o limite de crédito.');if(!Number.isFinite(amount)||amount<=0)throw Error('Informe um valor positivo.');if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||isNaN(Date.parse(date)))throw Error('Informe uma data válida.');if(!name||name.length>120)throw Error('Informe uma descrição de até 120 caracteres.');if(!['in','out'].includes(direction))throw Error('Tipo de movimentação inválido.');return {name,amount,date,wallet,direction,currency:walletDefinition(records,wallet).currency};}
export function walletAmount(amount: number, sourceCurrency: string, definition: any) {
 const currency = definition.currency || 'BRL';
 if (sourceCurrency === currency) return amount;
 const rate = (code: string) => code === 'BRL' ? 1 : definition.balanceRates?.[code] || 1;
 return amount * rate(sourceCurrency) / rate(currency);
}
export function walletBalances(records: any[]) {
 const names = walletNames(records);
 const definitions = new Map(names.map(name => [name, walletDefinition(records, name)]));
 const balances: Record<string, number> = Object.fromEntries(names.map(name => [name, definitions.get(name)?.type==='credito'?Number(definitions.get(name).creditLimit):0]));
 function add(name: string, amount: number, currency: string) {
  const definition = definitions.get(name);
  if (definition && definition.type!=='credito') balances[name] += walletAmount(amount, currency, definition);
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
  if (row.kind === 'transaction' && !row.voided && !row.paid && row.type==='expense') {
   const wallet=transactionWallet(row);
   if(definitions.get(wallet)?.type==='credito') balances[wallet]=Math.round(balances[wallet]*100-Math.round(amount*100))/100;
  }
  if (row.kind === 'transaction' && row.paid && !row.voided) {
   if(row.credit===true){
    if(row.creditPaidFrom==='Dinheiro')add('Dinheiro',-amount,'BRL');
    continue;
   }
   const wallet = row.wallet || (row.paymentMethod === 'Pix' ? 'Dinheiro' : row.paymentMethod) ||
    (row.type === 'income' ? 'Dinheiro' : null);
   add(wallet, (row.type === 'income' ? 1 : -1) * amount, 'BRL');
  }
 }
 return balances;
}
export function validateWalletTransfer(raw:any,records:any[],excludeId?:string){const fromWallet=String(raw?.fromWallet||''),toWallet=String(raw?.toWallet||''),amount=Number(raw?.amount),date=String(raw?.date||'');if(!walletsForTransfer(records).includes(fromWallet)||!walletsForTransfer(records).includes(toWallet)||fromWallet===toWallet)throw Error('Selecione duas carteiras diferentes com transferências habilitadas.');if(!Number.isFinite(amount)||amount<=0||amount>1000000000||Math.abs(amount*100-Math.round(amount*100))>0.000001)throw Error('Informe um valor positivo com até duas casas decimais.');if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||isNaN(Date.parse(date))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw Error('Informe uma data válida.');if(Math.round(walletBalances(records.filter(r=>!excludeId||r.id!==excludeId))[fromWallet]*100)<Math.round(amount*100))throw Error('Saldo insuficiente na carteira de origem.');return {name:'Transferência entre carteiras',fromWallet,toWallet,amount,date,paid:true};}


export function transactionWallet(row:any):string {
 return row?.wallet || (row?.paymentMethod==='Pix'?'Dinheiro':row?.paymentMethod) || 'Dinheiro';
}

export function creditTransaction(data:any,records:any[],prior?:any,paymentStatusOnly=false) {
 const name=transactionWallet(data),wallet=walletDefinition(records,name);
 const wasCredit=!!prior&&(prior.credit===true||walletDefinition(records,transactionWallet(prior)).type==='credito');
 if(wasCredit&&name!==transactionWallet(prior))throw Error('A carteira de uma despesa de crédito não pode ser alterada.');
 if(wallet.type!=='credito'&&!wasCredit)return data;
 if(data.type!=='expense')throw Error('Carteiras de crédito aceitam apenas despesas.');
 const cents=Math.round(Number(data.amount)*100);
 const installments=prior?1:Math.min(48,Math.max(1,Math.trunc(Number(data.installments)||1)));
 if(!Number.isFinite(cents)||cents<installments||Math.abs(Number(data.amount)*100-cents)>1e-5)throw Error('Informe um valor com até duas casas decimais e ao menos um centavo por parcela.');
 const paid=wasCredit&&(paymentStatusOnly?data.paid===true:prior.paid===true);
 if(!paid&&wallet.type==='credito'&&cents>Math.round(walletBalances(records.filter(r=>!prior||r.id!==prior.id))[name]*100))throw Error('Limite disponível insuficiente nesta carteira.');
 const creditPaidFrom=paid?(paymentStatusOnly&&!prior.paid?'Dinheiro':prior.creditPaidFrom):undefined;
 return {...data,wallet:name,paymentMethod:name,paid,credit:true,creditPaidFrom};
}
