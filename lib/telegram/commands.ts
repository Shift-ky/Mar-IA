import {declaredTransaction} from './automatic-proof';
import {parseCommand as parseLegacy} from '../whatsapp/commands';
import {summary,money} from '../whatsapp/commands';
export {summary,money};
export const menuKeyboard={remove_keyboard:true};
export function shoppingList(records:any[],requestedPage=1){
 const items=records.filter(p=>p.kind==='shoppingItem'&&!p.bought).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 if(!items.length)return 'Lista de compras vazia. Adicione os itens no aplicativo.';
 const pages=Math.ceil(items.length/20),page=Math.min(pages,Math.max(1,Math.floor(requestedPage)||1));
 return `Lista de compras${pages>1?` · página ${page}/${pages}`:''}\nItens a comprar:\n\n`+items.slice((page-1)*20,page*20).map(p=>`• ${p.name}: ${p.quantity.toLocaleString('pt-BR',{maximumFractionDigits:3})} ${p.unit}`).join('\n')+(page<pages?`\n\nPróxima página: /compras ${page+1}`:'');
}
export const help='O que você deseja fazer na Mar IA?\n\n• Ver saldo disponível: receitas menos despesas confirmadas.\n• Ver tudo: resumo financeiro e últimas movimentações.\n• Lista de compras: itens pendentes da lista compartilhada da família.\n• Adicionar lançamento: escolha receita ou despesa.\n• Excluir um cupom: envie cupons para obter o ID; depois excluir cupom ID.\n• Registrar compra: 50 em dinheiro, 50 alimentação ou 50 refeição.\n• Enviar comprovante: registro automático quando os dados estiverem completos. Somente cupons fiscais pedem aprovação.\n\nUse o botão Menu do Telegram para escolher uma opção. Se ainda não vinculou sua conta, entre na Mar IA → Telegram → Gerar código de vínculo.\nhttps://financas-familia-robson.merryscout8.chatgpt.site/';
export function guide(topic:string){if(topic==='expense')return 'Adicionar despesa\n\nEnvie o valor e a descrição, assim:\ndespesa 32,50 supermercado\n\nO lançamento será registrado como despesa paga, com a data de hoje. Você também pode escrever: 50 em dinheiro, 50 alimentação ou 50 refeição. Para outra data ou pagamento pendente, use o aplicativo. Você também pode anexar um comprovante.';if(topic==='income')return 'Adicionar receita\n\nEnvie o valor e a descrição, assim:\nreceita 1500 salario\n\nO lançamento será registrado como receita recebida, com a data de hoje. Para outra data ou receita prevista, use o aplicativo.';if(topic==='document')return 'Enviar comprovante\n\nToque no clipe e anexe o PDF ou uma foto (JPEG/PNG), de até 10 MB. PDFs com texto têm leitura do valor e data. Para salvar automaticamente, escreva na legenda: dinheiro, vale-alimentação ou vale-refeição. Se faltar informação, revise em Mar IA → Telegram → Comprovantes. Fotos e PDFs digitalizados podem precisar de preenchimento manual.';return 'Adicionar lançamento\n\nO valor entrou ou saiu?\n• Se entrou, escolha /receita no Menu.\n• Se saiu, escolha /despesa no Menu.\n\nOu escreva, por exemplo:\ndespesa 32,50 supermercado\nreceita 1500 salario';}
export function availableSummary(records:any[]){const tx=records.filter(r=>r.kind==='transaction'&&r.paid===true&&!r.voided);const total=tx.reduce((sum,r)=>sum+(r.type==='income'?1:-1)*Number(r.amount||0),0);return 'Saldo disponível: '+money(total);}
export function overview(records:any[]){const tx=records.filter(r=>r.kind==='transaction'&&!r.voided);const recent=[...tx].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,5);return 'Visão geral da sua família\n\n'+availableSummary(records)+'\n\nTodos os lançamentos, incluindo previstos\n'+summary(records).split('\n').slice(1).join('\n')+'\n\nÚltimas movimentações\n'+(recent.map(r=>`${r.date} · ${r.name} · ${r.type==='expense'?'-':'+'}${money(r.amount)}${r.paid?'':' · pendente'}`).join('\n')||'Nenhuma movimentação registrada.')+'\n\n'+tx.length+' lançamento(s) · '+records.filter(r=>r.kind==='card').length+' cartão(ões) · '+records.filter(r=>r.kind==='goal').length+' meta(s).\nPara ver e editar todos os detalhes:\nhttps://financas-familia-robson.merryscout8.chatgpt.site/';}
export function parseCommand(text:string,date?:string){
 let normalized=text.trim().replace(/^\/(\w+)(?:@[a-zA-Z0-9_]+)?(?=\s|$)/,'$1');
 normalized=normalized.replace(/^start\s+([a-zA-Z0-9_-]{20,100})$/i,'vincular $1');
 normalized=normalized.replace(/^([a-f0-9]{48})$/i,'vincular $1').replace(/^ver\s+saldo$/i,'saldo');
 const key=normalized.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const deletion=key.match(/^(?:excluir|apagar)\s+(?:cupom|comprovante)\s+([\w-]{10,100})$/);if(deletion)return {action:'receiptDelete',documentId:deletion[1]};
 if(['cupons','meus cupons','comprovantes','listar cupons'].includes(key))return {action:'receipts'};
 if(['menu','start','ajuda','help'].includes(key))return {action:'help'};
 if(['saldo','disponivel','saldo disponivel','ver saldo disponivel'].includes(key))return {action:'available'};
 if(['tudo','ver tudo','visao geral'].includes(key))return {action:'overview'};
 const shopping=key.match(/^(?:compras|(?:ver |solicitar )?lista de compras?)(?:\s+([1-9]\d{0,5}))?$/);
 if(shopping)return {action:'shopping',page:Number(shopping[1]||1)};
 if(['lancamento','adicionar lancamento','novo lancamento'].includes(key))return {action:'guide',topic:'entry'};
 if(['despesa','adicionar despesa','adicionar dispeza','registrar despesa'].includes(key))return {action:'guide',topic:'expense'};
 if(['receita','adicionar receita','registrar receita'].includes(key))return {action:'guide',topic:'income'};
 if(['comprovante','enviar comprovante'].includes(key))return {action:'guide',topic:'document'};
 if(key==='relatorio do mes')normalized='relatório';
 const declaration=declaredTransaction(normalized,date);if(declaration)return declaration;
 const command=parseLegacy(normalized,date);
 if(command.data)command.data.source='telegram';
 return command;
}
