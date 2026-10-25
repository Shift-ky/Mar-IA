import {getDocumentProxy} from 'unpdf';
import {parseFiscalCouponText} from './fiscal-coupon';

const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const amountPattern=/(?<![\d.,])(?:R\$\s*)?(\d{1,3}(?:\.\d{3})+,\d{2}|\d{1,9},\d{2}|\d{1,9}\.\d{2})(?![\d.,])/g;
function amounts(s:string){return [...s.matchAll(amountPattern)].map(m=>Number(m[1].includes(',')?m[1].replaceAll('.','').replace(',','.'):m[1])).filter(n=>n>0&&n<=99999999)}
const valueLabel=/^(?:valor(?:\s+(?:da\s+transacao|da\s+operacao|da\s+transferencia|do\s+pagamento|do\s+pix|transferido|pago|total))?|total(?:\s+(?:pago|da\s+transacao|do\s+pagamento))?)\s*(?::|-|r\$|\d|$)/;
function dateValue(s:string){const match=s.match(/\b(\d{2})[\/-](\d{2})[\/-](20\d{2})\b/)||s.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);if(!match)return null;const date=match[1].length===4?`${match[1]}-${match[2]}-${match[3]}`:`${match[3]}-${match[2]}-${match[1]}`;const parsed=new Date(date+'T12:00:00Z');return !isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===date?date:null}

export function parsePdfReceiptText(text:string):any{
 const coupon=parseFiscalCouponText(text);if(coupon)return coupon;
 const lines=text.replace(/\u00a0/g,' ').split(/\r?\n/).map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean);
 if(!text.trim())return {extraction:'image_only',reason:'Este PDF não contém texto legível. Preencha o valor manualmente ou use um serviço de leitura de imagens.'};
 const candidates:number[]=[];
 for(let i=0;i<lines.length;i++){if(!valueLabel.test(normalize(lines[i])))continue;let found=amounts(lines[i]);if(!found.length&&i+1<lines.length&&/^(?:r\$\s*)?[\d.,\s]+$/i.test(lines[i+1]))found=amounts(lines[i+1]);candidates.push(...found)}
 const isProof=/comprovante|transferencia\s+(?:realizada|efetuada)|pagamento\s+(?:realizado|efetuado)|pix\s+(?:enviado|recebido)/.test(normalize(text));
 if(!candidates.length&&isProof){for(const line of lines)if(/r\$/i.test(line))candidates.push(...amounts(line))}
 const unique=[...new Set(candidates.map(n=>Math.round(n*100)))];
 if(unique.length!==1||!isProof)return {extraction:unique.length>1?'ambiguous':'not_found',reason:unique.length>1?'O PDF contém valores diferentes. Confira o valor da transação no original e preencha antes de confirmar.':'Não encontrei um valor único de transação neste PDF. Confira o documento e preencha os dados.'};
 const total=unique[0]/100;
 let date:string|null=null;
 const labeledDates:string[]=[];
 for(let i=0;i<lines.length;i++)if(/^(?:data(?:\s+(?:e hora|da transacao|do pagamento|da transferencia))?|realizado em|efetuado em)\b/.test(normalize(lines[i]))){const d=dateValue(lines[i])||dateValue(lines[i+1]||'');if(d)labeledDates.push(d)}
 const allDates=labeledDates.length?labeledDates:lines.map(dateValue).filter((d):d is string=>!!d);
 if(new Set(allDates).size===1)date=allDates[0];
 const title=lines.find(l=>/comprovante/i.test(l))?.slice(0,120)||'Comprovante recebido pelo Telegram';
 return {extraction:'pdf_text',draft:{store:title,date:date||'',total,discount:0,extra:0,items:[],fiscalKey:null,proof:true,type:'expense'},reason:`Valor identificado no PDF: R$ ${total.toFixed(2).replace('.',',')}. Confira a descrição, a data e se é receita ou despesa antes de confirmar.`,requiresReview:true};
}

export async function extractPdfReceipt(bytes:Uint8Array):Promise<any>{
 if(bytes.byteLength>10485760)return {extraction:'too_large',reason:'PDF maior que 10 MB. Preencha os dados manualmente.'};
 let pdf:Awaited<ReturnType<typeof getDocumentProxy>>|undefined;
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  const operation=(async()=>{
   pdf=await getDocumentProxy(new Uint8Array(bytes),{disableFontFace:true,useSystemFonts:false,maxImageSize:0});
   if(pdf.numPages>10)throw Error('too_many_pages');
   const lines:string[]=[];let length=0;
   for(let n=1;n<=pdf.numPages;n++){
    const page=await pdf.getPage(n);const content=await page.getTextContent();let line='',lastY:number|undefined;
    for(const item of content.items){if(!('str' in item))continue;const y=item.transform[5];if(lastY!==undefined&&Math.abs(y-lastY)>3&&line){lines.push(line);line=''}line+=(line?' ':'')+item.str;lastY=y;length+=item.str.length;if(length>200000)throw Error('too_much_text');if(item.hasEOL&&line){lines.push(line);line='';lastY=undefined}}
    if(line)lines.push(line);page.cleanup();
   }
   return parsePdfReceiptText(lines.join('\n'));
  })();
  return await Promise.race([operation,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),10000)})]);
 }catch{return {extraction:'unreadable',reason:'Não foi possível ler o texto deste PDF. Ele pode estar digitalizado, protegido por senha ou fora dos limites de leitura. Preencha os dados manualmente.'}}
 finally{if(timer)clearTimeout(timer);await pdf?.loadingTask.destroy().catch(()=>{})}
}
