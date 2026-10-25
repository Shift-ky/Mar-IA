import {validateReceipt} from '../whatsapp/receipts';
const normalized=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const numeric=(s:string)=>Number(s.includes(',')?s.replaceAll('.','').replace(',','.'):s);
const decimal='(\\d{1,3}(?:\\.\\d{3})*,\\d{2,4}|\\d+(?:[.,]\\d{2,4}))';
const row=new RegExp('^\\d{1,6}\\s+(\\d+(?:[.,]\\d{1,3})?)\\s+(PC|PÇ|PCT|UN|UND|KG|G|L|LT|ML)\\s*[x×]\\s*(?:R\\$\\s*)?'+decimal+'\\s+(?:R\\$\\s*)?'+decimal+'$','i');
function amountAfter(lines:string[],label:RegExp){for(let i=0;i<lines.length;i++){const n=normalized(lines[i]);if(!label.test(n))continue;const m=lines[i].match(/(?:R\$\s*)(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2})/);if(m)return numeric(m[1]);const next=lines[i+1]?.match(/^(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2})$/);if(next)return numeric(next[1]);}return null}
export function parseFiscalCouponText(text:string):any|null{
 if(!/nfc-?e|cupom fiscal|danfe/i.test(text))return null;
 const lines=text.split(/\r?\n/).map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean);
 const items:any[]=[];
 for(let i=1;i<lines.length;i++){
  const m=row.exec(lines[i]);if(!m)continue;
  const name=lines[i-1];if(name.length>100||!/[a-zA-ZÀ-ÿ]/.test(name))continue;
  const unit=normalized(m[2]);const mapped=['pc','pç','pct','un','und'].includes(unit)?'un':unit==='lt'?'l':unit;
  items.push({name,quantity:numeric(m[1]),unit:mapped,unitPrice:numeric(m[3]),lineTotal:numeric(m[4])});
 }
 const count=normalized(text).match(/total de itens\s*[:\-]?\s*(\d+)/)?.[1];
 if(!items.length||count&&items.length!==Number(count))return {extraction:'coupon_incomplete',reason:'O cupom foi reconhecido, mas nem todos os produtos foram lidos. Revise nomes, quantidades e preços antes de confirmar.'};
 const total=amountAfter(lines,/^valor a pagar\b/)??amountAfter(lines,/^valor total\b/)??amountAfter(lines,/^total\s*(?:r\$|:)/);
 const discount=amountAfter(lines,/^desconto(?:s)?\b/)??0,extra=amountAfter(lines,/^acrescimo(?:s)?\b/)??0;
 const rawDate=text.match(/\b(\d{2})\/(\d{2})\/(20\d{2})\b/);
 const date=rawDate?`${rawDate[3]}-${rawDate[2]}-${rawDate[1]}`:'';
 const key=text.match(/\b(?:\d{4}\s+){10}\d{4}\b/)?.[0].replace(/\s/g,'')||null;
 const draft={store:lines[0].slice(0,120),date,total,discount,extra,items,fiscalKey:key,proof:false};
 try{validateReceipt(draft)}catch{return {extraction:'coupon_unbalanced',draft,requiresReview:true,reason:'Produtos identificados, mas os valores ou a data precisam de conferência. Ajuste o cupom para que a soma dos itens corresponda ao total.'}}
 return {extraction:'fiscal_coupon_text',draft,requiresReview:true,reason:`Cupom lido: ${items.length} itens com quantidade, unidade e valor unitário. Ao confirmar, produtos ausentes serão cadastrados automaticamente e as quantidades somadas ao estoque.`};
}
