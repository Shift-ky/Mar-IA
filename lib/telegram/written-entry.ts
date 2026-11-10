const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
export function writtenEntry(input:string){
 const match=input.trim().match(/^(?:(entrada|sa[ií]da|receita|despesa)\s*[,;:\n ]\s*)?(?:R\$\s*)?(\d+(?:\.\d{3})*(?:[.,]\d{1,2})?)\s*[,;\n]\s*([^,;\n]+)\s*[,;\n]\s*([^,;\n]+)\s*[,;\n]\s*([\s\S]*)$/i);
 if(!match){if(/^(?:(?:entrada|sa[ií]da|receita|despesa)\s*[,;:\n ]\s*)?(?:R\$\s*)?\d[\d.,]*\s*[,;\n]\s*(?:dinheiro|pix|alimenta[cç][aã]o|refei[cç][aã]o|gasolina|combust[ií]vel)\s*[,;\n]/i.test(input.trim()))throw Error('Envie saída ou entrada, valor, forma de pagamento, data e descrição. Exemplo: saída, 50, Pix, 27/10/2026, compra no mercado.');return null;}
 if(!match[1])throw Error('Comece com saída ou entrada. Exemplo: saída, 50, Pix, 27/10/2026, compra no mercado.');
 const amount=Number(match[2].includes(',')?match[2].replace(/\./g,'').replace(',','.'):match[2]);
 if(!Number.isFinite(amount)||amount<=0||amount>1e9)throw Error('Informe um valor positivo. Exemplo: saída, 50, Pix, 27/10/2026, compra no mercado.');
 const methods:Record<string,string>={dinheiro:'Dinheiro',pix:'Pix',alimentacao:'Vale-alimentação','vale-alimentacao':'Vale-alimentação',refeicao:'Vale-refeição','vale-refeicao':'Vale-refeição',gasolina:'Combustível',combustivel:'Combustível'};
 const paymentMethod=methods[normalize(match[3])];if(!paymentMethod)throw Error('Forma de pagamento inválida. Use Dinheiro, Pix, Alimentação, Refeição ou Gasolina.');
 let date=match[4].trim();const br=date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(br)date=br[3]+'-'+br[2]+'-'+br[1];
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(date)||isNaN(Date.parse(date))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw Error('Data inválida. Use DD/MM/AAAA, como 27/10/2026.');
 const name=match[5].trim();if(!name||name.length>120)throw Error('Informe uma descrição de até 120 caracteres.');
 const type=['receita','entrada'].includes(normalize(match[1]))?'income':'expense';
 return {name,amount,paymentMethod,date,type,paid:true,category:type==='income'?'Outros':paymentMethod==='Combustível'?'Transporte':['Vale-alimentação','Vale-refeição'].includes(paymentMethod)?'Alimentação':'Outros',source:'telegram'};
}
