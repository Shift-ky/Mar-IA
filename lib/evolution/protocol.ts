export const help='Olá! Sou a Maria, assistente da Mar IA.\n\nMENU\n1. Feira — digite: feira\n2. Saldo — digite: saldo\n3. Movimentações — digite: movimentações\n4. Relatório mensal — digite: relatório 2026-11\n5. Registrar despesa — exemplo: despesa 32,50 supermercado\n6. Registrar receita — exemplo: receita 1500 salário\n7. Enviar comprovante — mande uma foto ou PDF do cupom para revisão.\n\nPara abrir este menu, escreva: olá Maria.\nEm grupos, você também pode usar: Maria, feira ou Maria, saldo. Para registrar, informe a forma de pagamento e a carteira e depois responda CONFIRMAR.';
export function normalize(payload:any,instance:string){
 if(payload?.instance!==instance||!['messages.upsert','MESSAGES_UPSERT'].includes(payload?.event))return null;
 const d=payload.data,k=d?.key;if(!k||k.fromMe||typeof k.id!=='string'||k.id.length>200)return null;
 const groupChat=k.remoteJid?.endsWith('@g.us');
 const phoneJid=(primary:any,alternate:any)=>/^\d{7,18}@s\.whatsapp\.net$/.test(primary||'')?primary:alternate;
 const chat=groupChat?k.remoteJid:phoneJid(k.remoteJid,k.remoteJidAlt),sender=groupChat?phoneJid(k.participant,k.participantAlt):chat;
 if(!/^\d{7,18}@s\.whatsapp\.net$/.test(sender||'')||!(/^[\d-]{7,40}@g\.us$/.test(chat||'')||chat===sender))return null;
 const content=d.message,text=content?.conversation||content?.extendedTextMessage?.text||content?.imageMessage?.caption||content?.documentMessage?.caption||'';
 const group=chat.endsWith('@g.us');
 const menuGreeting=/^\s*ol[aá][,\s]+maria[.!?,]*\s*$/i.test(text);\n if(group&&!menuGreeting&&!/^maria\s*[,;:]?\s+/i.test(text))return null;
 const timestamp=Number(d.messageTimestamp);if(!Number.isFinite(timestamp)||Math.abs(Date.now()/1000-timestamp)>86400)return null;
 return {key:instance+':'+chat+':'+k.id,chat,sender,text:(group?text.replace(/^maria\s*[,;:]?\s+/i,''):text).slice(0,4000),group,media:!!(content?.imageMessage||content?.documentMessage||content?.audioMessage)};
}
