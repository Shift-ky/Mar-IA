import {validateShopping} from '../shopping';
const units:Record<string,string>={un:'un',unidade:'un',unidades:'un',kg:'kg',quilo:'kg',quilos:'kg',g:'g',grama:'g',gramas:'g',l:'l',litro:'l',litros:'l',ml:'ml',pacote:'pacote',pacotes:'pacote',caixa:'caixa',caixas:'caixa'};
// Strict command boundaries keep financial commands and ordinary messages out of the shopping flow.
export function shoppingIntent(input:string):string|null{
 const text=input.trim();
 const command=text.match(/^\/(?:comprar|adicionar_compra)(?:@\w+)?\s+(.+)$/i);
 if(command)return command[1];
 const match=text.match(/^(?:adicionar|adicione|adiciona|incluir|inclua|colocar|coloque|coloca)\s+(.+?)(?:\s+(?:na|à|a)\s+lista(?:\s+de\s+compras)?)?[.!]?$/i);
 if(!match||/^(?:receita|despesa|lançamento|lancamento|saldo|recebimento)\b/i.test(match[1]))return null;
 return match[1];
}
export function parseShoppingMessage(input:string){
 const text=input.trim().replace(/[.!]$/,'').trim();
 if(text.includes(';')){const fields=text.split(';').map(s=>s.trim());if(fields.length!==3)throw Error('Use: Arroz; 2; kg');return validateShopping({name:fields[0],quantity:fields[1].replace(',','.'),unit:fields[2]});}
 const match=text.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/);
 let name=text,quantity=1,unit='un';
 if(match){quantity=Number(match[1].replace(',','.'));name=match[2];const first=name.match(/^(\S+)\s+(.+)$/);if(first&&units[first[1].toLowerCase()]){unit=units[first[1].toLowerCase()];name=first[2].replace(/^de\s+/i,'');}}
 else if(/^[-+\d]/.test(text))throw Error('Informe uma quantidade positiva. Exemplo: 2 kg de arroz.');
 if(!name||/^\d/.test(name))throw Error('Informe o nome do produto.');
 return validateShopping({name,quantity,unit});
}

export function parseShoppingBatch(input:string){
 // A comma inside the leading quantity is decimal; the other commas separate items.
 const parts:string[]=[];let start=0;
 for(let i=0;i<input.length;i++)if(input[i]===','){
  const prefix=input.slice(start,i);
  const decimal=/\d/.test(input[i-1]||'')&&/\d/.test(input[i+1]||'')&&/^(?:\s*\d+|\s*[^;]+;\s*\d+)$/.test(prefix);
  if(!decimal){parts.push(input.slice(start,i).trim());start=i+1;}
 }
 parts.push(input.slice(start).trim());
 if(parts.length>20)throw Error('Envie até 20 itens por mensagem.');
 if(parts.some(p=>!p))throw Error('Informe um produto entre as vírgulas. Exemplo: 2 arroz, 2 feijão.');
 return parts.map(parseShoppingMessage);
}
