import {paymentMethods} from '../payment-methods';
import {validateReceipt} from '../whatsapp/receipts';
import {parseMoney} from '../whatsapp/commands';

export function declaredTransaction(text:string,date=new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'})):any|null{
 const normalized=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const method='(dinheiro|(?:vale[- ]?)?alimentacao|(?:vale[- ]?)?refeicao|combustivel|combustível|va|vr)';
 const paymentOnly=new RegExp('^(?:(?:no|na|em|com)\\s+)?'+method+'$').exec(normalized);
 if(paymentOnly)return {action:'paymentDeclaration',paymentMethod:declaredPayment(paymentOnly[1])};
 const match=new RegExp('^(?:(?:lancar|registrar|pagar|gastei|despesa)\\s+)?(?:r\\$\\s*)?(\\d{1,9}(?:[.,]\\d{1,2})?)\\s*(?:reais?\\s+)?(?:(?:no|na|em|com|pelo|pela)\\s+)?'+method+'[.!]?$').exec(normalized);
 if(!match)return null;
 const paymentMethod=declaredPayment(match[2]);
 return {action:'transaction',declaredPayment:true,data:{name:'Despesa em '+paymentMethod,type:'expense',amount:parseMoney(match[1]),date,paymentMethod,category:'Outros',paid:true,source:'telegram'}};
}

export function declaredPayment(text:string){
 const normalized=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const matches=[/\bdinheiro\b/,/\b(?:vale[ -]?)?alimentacao\b|\bva\b/,/\b(?:vale[ -]?)?refeicao\b|\bvr\b/,/\bcombustivel\b/].map((p,i)=>p.test(normalized)?paymentMethods[i]:null).filter(Boolean);
 return matches.length===1?matches[0]:null;
}
export function automaticProof(extraction:any,caption:string){
 const candidate=extraction.receipt||extraction.draft;
 const paymentMethod=declaredPayment(caption);
 if(!paymentMethod||!candidate?.proof||!['pdf_text',undefined].includes(extraction.extraction))return null;
 const declaration=declaredTransaction(caption);
 if(declaration?.data&&Math.round(declaration.data.amount*100)!==Math.round(Number(candidate.total)*100))return null;
 // Missing dates or uncertain totals must continue through document review.
 try{return validateReceipt({...candidate,paymentMethod})}catch{return null}
}
