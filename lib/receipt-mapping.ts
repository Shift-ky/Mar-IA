import {resolveReceiptProduct} from './inventory';

// Only explicit choices and previously established mappings may commit stock.
export function unresolvedReceiptItems(receipt:any,records:any[]){
 return receipt.proof?[]:receipt.items.filter((line:any)=>line.productId!=='new'&&!resolveReceiptProduct(line,records));
}
export function requireReceiptMappings(receipt:any,records:any[]){
 if(unresolvedReceiptItems(receipt,records).length)throw Error('Associe todos os produtos sem de/para ou escolha cadastrar como novo na tela de revisão do cupom.');
}
