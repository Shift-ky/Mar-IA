import {build} from '../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild/lib/main.js';
import {Miniflare} from '../node_modules/.pnpm/miniflare@4.20260515.0_@types+node@22.19.19/node_modules/miniflare/dist/src/index.js';
import {mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
mkdirSync('work',{recursive:true});
await build({entryPoints:['lib/telegram/pdf-receipt.ts'],bundle:true,platform:'node',format:'esm',outfile:'work/pdf-receipt-test.mjs'});
const {parsePdfReceiptText:parse,extractPdfReceipt:extract}=await import('../work/pdf-receipt-test.mjs');
const proof='Comprovante de pagamento\nValor: R$ 1.234,56\nData: 24/10/2026';
assert.equal(parse(proof).draft.total,1234.56);assert.equal(parse(proof).draft.date,'2026-10-24');assert(!parse(proof).receipt);
assert.equal(parse('Comprovante PIX\nValor\nR$ 32,50\nData e hora\n24/10/2026').draft.total,32.5);
assert.equal(parse('Comprovante de pagamento\nValor R$ 120,00\nDesconto R$ 5,00\nCPF 123.456.789-00').draft.total,120);
assert.equal(parse('Comprovante de pagamento\nValor R$ 100,00\nTotal pago R$ 90,00').extraction,'ambiguous');
assert.equal(parse('Comprovante\nValor R$ 40,00\nData 31/02/2026').draft.date,'');
assert.equal(parse('Comprovante\nCPF 123.456.789-00\nDocumento 2026.10').extraction,'not_found');
assert.equal(parse('').extraction,'image_only');
function fixture(lines){
 const stream='BT /F1 12 Tf 50 790 Td 18 TL '+lines.map((line,i)=>(i?'T* ':'')+'('+line.replace(/[()\\]/g,'\\$&')+') Tj').join(' ')+' ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
 let source='%PDF-1.4\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(source));source+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`}
 const xref=Buffer.byteLength(source);source+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 return new Uint8Array(Buffer.from(source));
}
const bytes=fixture(proof.split('\n'));const extracted=await extract(bytes);assert.equal(extracted.draft.total,1234.56);assert.equal(extracted.draft.date,'2026-10-24');assert.equal(extracted.requiresReview,true);
assert.equal((await extract(new TextEncoder().encode('%PDF-not-a-valid-file'))).extraction,'unreadable');
await build({stdin:{contents:"import {extractPdfReceipt} from './lib/telegram/pdf-receipt';export default {async fetch(req){return Response.json(await extractPdfReceipt(new Uint8Array(await req.arrayBuffer())))}};",resolveDir:process.cwd()},bundle:true,platform:'browser',format:'esm',outfile:'work/pdf-runtime-worker.js'});
const mf=new Miniflare({modules:true,compatibilityDate:'2026-05-15',scriptPath:'work/pdf-runtime-worker.js'});
try{const r=await mf.dispatchFetch('https://test.invalid/pdf',{method:'POST',body:bytes});const result=await r.json();assert.equal(result.draft?.total,1234.56,JSON.stringify(result));assert(!result.receipt)}finally{await mf.dispose()}
console.log('PASS: real text PDF extraction in Node and Workers, Brazilian amounts, date validity, conflicting amounts, image-only/unreadable fallback, and review required before posting.');
