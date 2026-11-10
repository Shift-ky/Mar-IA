export const paymentMethods=['Dinheiro','Vale-alimentação','Vale-refeição','Combustível','Pix'] as const;
export function paymentAnswer(value:string){const answer=value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/^(?:foi pago via|foi pago no|paguei via|paguei no|pago via|pago no|via|em|no|na|com)\s+/,'').replace(/[\s-]+/g,'').replace(/[.,!?;:]+$/,'');return paymentMethods.find(method=>method.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\s-]+/g,'').toLowerCase()===answer)||null;}
const removedPaymentMethods=new Set(['transferencia','transferencia bancaria','debito','cartao debito','cartao de debito','credito','cartao credito','cartao de credito']);
export function isRemovedPaymentMethod(value:unknown){return typeof value==='string'&&removedPaymentMethods.has(value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase());}
export function receiptPayment(raw:unknown){
 if(raw===undefined||raw===null||raw==='')return {};
 if(!paymentMethods.includes(raw as any))throw Error('Forma de pagamento inválida.');
 return {paymentMethod:raw as typeof paymentMethods[number]};
}
