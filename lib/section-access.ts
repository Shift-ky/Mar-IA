import {creditInstallment} from './credit-installments';

export const APP_ACCESS_SECTIONS=[
 {key:'home',label:'Início'},
 {key:'finance',label:'Finanças'},
 {key:'recurring',label:'Contas fixas'},
 {key:'review',label:'Conferência'},
 {key:'feira',label:'Feira'},
 {key:'stock',label:'Estoque'},
 {key:'wallets',label:'Carteiras'},
 {key:'goals',label:'Metas'},
 {key:'appearance',label:'Personalização'},
 {key:'family',label:'Família'},
 {key:'integrations',label:'Integrações'},
 {key:'sync',label:'Sincronização'},
 {key:'profile',label:'Meu cadastro'},
] as const;

export type AppSectionKey=typeof APP_ACCESS_SECTIONS[number]['key'];

export function sectionsFor(permissions:any={}){
 return Object.fromEntries(APP_ACCESS_SECTIONS.map(({key})=>[key,permissions?.sections?.[key]!==false])) as Record<AppSectionKey,boolean>;
}

export function sectionForTab(tab:string):AppSectionKey|undefined{
 return APP_ACCESS_SECTIONS.find(({label})=>label===tab)?.key;
}

export function sectionForMutation(action:string,kind?:string,data?:any):AppSectionKey[]{
 if(['feiraItem','feiraCopy','feiraDelete'].includes(action))return ['feira'];
 if(action==='feiraSave')return data?.payment&&data.payment!=='Não lançar'?['feira','finance','stock']:['feira'];
 if(action==='stockMove'||action==='stockOrder'||kind==='product'||kind==='productGroup')return ['stock'];
 if(kind==='shoppingItem')return ['feira'];
 if(['goal','goalContribution','savingsPlan'].includes(kind))return ['goals'];
 if(kind==='recurringBill'||action==='recurringSkip')return ['recurring'];
 if(kind==='wallet'||kind==='walletMovement'||kind==='walletTransfer'||action==='walletDelete')return ['wallets'];
 if(kind==='transaction'||kind==='card')return ['finance'];
 if(['receiptApprove','receiptReject','draftConfirm','draftCancel','receiptDelete'].includes(action))return ['review'];
 if(['member','approve','rejectRequest','removeMember','family'].includes(action))return ['family'];
 return [];
}

export function canAccessSections(permissions:any,keys:AppSectionKey[]){
 const sections=sectionsFor(permissions);
 return keys.every(key=>sections[key]);
}

export function recordAllowedBySections(record:any,permissions:any){
 const allow=(key:AppSectionKey)=>sectionsFor(permissions)[key];
 const recurring=record.kind==='recurringBill'||record.kind==='recurringSkip'||record.kind==='transaction'&&(!!record.recurringId||record.category==='Contas fixas'||!!creditInstallment(record));
 if(recurring)return record.kind==='transaction'?allow('finance')||allow('recurring'):allow('recurring');
 if(['transaction','card'].includes(record.kind))return allow('finance');
 if(['wallet','walletDeleted','walletMovement','walletTransfer'].includes(record.kind))return allow('wallets');
 if(['product','productGroup','stockMovement','purchaseItem'].includes(record.kind))return allow('stock');
 if(['shoppingItem','feiraPurchase'].includes(record.kind))return allow('feira');
 if(['goal','goalContribution','savingsPlan'].includes(record.kind))return allow('goals');
 return true;
}
