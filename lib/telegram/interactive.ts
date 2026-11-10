import {writtenEntry} from './written-entry';
import {walletNames,validateWalletTransfer,canTransferWallet} from '../wallets';
import {parseCommand} from './commands';
import {isRemovedPaymentMethod,paymentMethods} from '../payment-methods';
import {shoppingIntent,parseShoppingBatch} from './shopping-message';
export const buttons=(rows:any[])=>({inline_keyboard:rows});
export const button=(text:string,callback_data:string)=>({text,callback_data});
export const mainMenu=buttons([
 [button('Lançar despesa','mi:expense'),button('Lançar receita','mi:income')],
 [button('Consultar saldo','mi:balance'),button('Consultar lançamentos','mi:movements')],
 [button('Transferir entre carteiras','mi:transfer')],
 [button('Lista de compras','mi:shopping'),button('Relatórios financeiros','mi:report')],
 [button('Ocultar menu · digitar lançamento','mi:hide-menu')]
]);
export const back=buttons([[button('Voltar ao menu','mi:menu')]]);
export async function interactive(ctx:any){
 const {db,event,m,a,base,getRecords,finish}=ctx;
 const input=(m.text?.body||'').trim(),cb=m.callback,records=await getRecords(),wallets=walletNames(records).filter((name:string)=>canTransferWallet(records,name));
 const key='tg-flow:'+event.phone;
 const saved=ctx.savedFlow;
 let flow=saved?JSON.parse(saved.value):null;
 if(flow&&(flow.user!==a.user||flow.family!==a.family||flow.expires<Date.now()))flow=null;
 const save=(value:any)=>({sql:'INSERT INTO settings(key,value) SELECT ?,? WHERE $GUARD ON CONFLICT(key) DO UPDATE SET value=excluded.value',args:[key,JSON.stringify({...value,user:a.user,family:a.family,expires:Date.now()+1800000})]});
 const clear={sql:'DELETE FROM settings WHERE key=? AND $GUARD',args:[key]};
 const reply=async(text:string,markup:any=back,extras:any[]=[],permission='',rows:any[]=[])=>finish(text,markup,extras,permission,rows);
 const listKey='tg-shopping-view:'+event.phone;
 const signature=(r:any)=>JSON.stringify([r.name,r.quantity,r.unit]);
 const list=async(page=1,source:any[]|undefined=undefined,extras:any[]=[],permission='view')=>{
 if(!a.permissions.view)throw Error('Sem permissão para consultar.');
 const items=(source??await getRecords()).filter((r:any)=>r.kind==='shoppingItem'&&(!r.autoStock||a.permissions.stock!==false)).sort((x:any,y:any)=>x.id.localeCompare(y.id));
 const pages=Math.max(1,Math.ceil(items.length/20));page=Math.min(Math.max(1,page),pages);
 const start=(page-1)*20,shown=items.slice(start,start+20);
 const snapshot={user:a.user,family:a.family,expires:Date.now()+1800000,items:items.map((r:any)=>({id:r.id,signature:signature(r)}))};
 const view={sql:'INSERT INTO settings(key,value) SELECT ?,? WHERE $GUARD ON CONFLICT(key) DO UPDATE SET value=excluded.value',args:[listKey,JSON.stringify(snapshot)]};
 const nav=[];if(page>1)nav.push(button('Anterior','mi:shopping-page:'+(page-1)));if(page<pages)nav.push(button('Próxima','mi:shopping-page:'+(page+1)));
 await reply('Sua lista de compras'+(pages>1?` · ${page}/${pages}`:'')+'\n'+(shown.length?'Toque na caixa do produto para marcar ou desmarcar como comprado.\n\nPara alterar a lista, envie:\nexcluir o produto 1\neditar o produto 1':'Sua lista está vazia.'),buttons([...shown.map((r:any,i:number)=>[button(`${r.bought?'☑':'☐'} ${start+i+1}. ${r.name.slice(0,55)} · ${r.quantity} ${r.unit}`,'mi:check:'+(r.bought?'0:':'1:')+r.id)]),...(nav.length?[nav]:[]),[button('Adicionar item','mi:add')],[button('Voltar ao menu','mi:menu')]]),[...extras,view],permission);
 };
 if(!cb&&m.type==='text'){
 const data=writtenEntry(input);
 if(data){if(!a.permissions.add)throw Error('Sem permissão para registrar.');await reply(`${data.type==='income'?'Receita':'Despesa'} registrada: R$ ${data.amount.toFixed(2)}\n${data.paymentMethod} · ${data.date.split('-').reverse().join('/')}\n${data.name}`,buttons([]),[clear],'add',[{id:'tg-written-'+event.id,kind:'transaction',data}]);return true;}
 }
 if(cb==='mi:hide-menu'||/^\/?ocultar(?: menu)?$/i.test(input)){await reply('Menu oculto. Envie seu lançamento por escrito.\nExemplo: saída, 50, Pix, 27/10/2026, mercado\n\nPara mostrar o menu novamente, envie /menu.',buttons([]),[clear]);return true;}
 if(cb==='mi:menu'||/^(oi|olá|ola|\/start|\/menu)$/i.test(input)){await reply('Olá! O que você deseja fazer agora?',mainMenu,[clear]);return true;}
 if(cb==='mi:transfer'||/^\/?(?:transferir|transferencia)(?: entre carteiras)?$/i.test(input.normalize('NFD').replace(/[\u0300-\u036f]/g,''))){
 if(!a.permissions.add)throw Error('Sem permissão para registrar.');
 await reply('De qual carteira deseja transferir?',buttons([...wallets.map((wallet,i)=>[button(wallet,'mi:from:'+i)]),[button('Cancelar','mi:menu')]]),[save({step:'transfer-from',id:event.id})],'add');return true;
 }
 if(flow?.step?.startsWith('transfer-')){
 if(!a.permissions.add)throw Error('Sem permissão para registrar.');
 if(flow.step==='transfer-from'&&cb?.startsWith('mi:from:')){const fromWallet=wallets[Number(cb.slice(8))];if(!fromWallet)throw Error('Carteira inválida.');await reply('Para qual carteira?',buttons([...wallets.flatMap((wallet,i)=>wallet===fromWallet?[]:[[button(wallet,'mi:to:'+i)]]),[button('Cancelar','mi:menu')]]),[save({...flow,fromWallet,step:'transfer-to'})],'add');return true;}
 if(flow.step==='transfer-to'&&cb?.startsWith('mi:to:')){const toWallet=wallets[Number(cb.slice(6))];if(!toWallet||toWallet===flow.fromWallet)throw Error('Escolha duas carteiras diferentes.');await reply('Qual valor deseja transferir? Exemplo: 50,00',back,[save({...flow,toWallet,step:'transfer-amount'})],'add');return true;}
 if(flow.step==='transfer-amount'&&!cb){if(!/^\d+(?:[.,]\d{1,2})?$/.test(input))throw Error('Informe um valor positivo, como 50,00.');const date=new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'});const data=validateWalletTransfer({...flow,amount:Number(input.replace(',','.')),date},await getRecords());await reply(`Confirmar transferência de R$ ${data.amount.toFixed(2)}?\n${data.fromWallet} → ${data.toWallet}\nData: ${date}\nNão entra como receita ou despesa.`,buttons([[button('Confirmar transferência','mi:transfer-confirm:'+flow.id)],[button('Cancelar','mi:menu')]]),[save({...flow,...data,step:'transfer-confirm'})],'add');return true;}
 if(flow.step==='transfer-confirm'&&cb==='mi:transfer-confirm:'+flow.id){const data=validateWalletTransfer(flow,await getRecords());await reply(`Transferência registrada: R$ ${data.amount.toFixed(2)}\n${data.fromWallet} → ${data.toWallet}`,mainMenu,[clear],'add',[{id:'tg-transfer-'+flow.id,kind:'walletTransfer',data}]);return true;}
 if(cb)throw Error('Este botão expirou. Envie /menu para continuar.');
 }
 if(cb==='mi:expense'||cb==='mi:income'){
 if(!a.permissions.add)throw Error('Sem permissão para registrar.');
 await reply('Qual é o valor?',back,[save({step:'amount',type:cb.slice(3),id:event.id})],'add');return true;}
 if(cb==='mi:shopping'||cb?.startsWith('mi:shopping-page:')||(!cb&&(parseCommand(input).action==='shopping'||/^(?:(?:quero|mostrar|mostre|envie|manda|mande|me mande|me envie|ver)\s+)?(?:a |minha |a minha )?lista de compras?[.!?]?$/i.test(input)))){const command:any=parseCommand(input);const page=cb?.startsWith('mi:shopping-page:')?Number(cb.slice(17)):command.page||1;await list(Number.isSafeInteger(page)?page:1);return true;}
 const numbered=!cb&&m.type==='text'?input.match(/^(excluir|exclua|remover|remova|editar|edite|alterar|altere)\s+(?:o\s+)?(?:produto|item)\s+(\d+)[.!]?$/i):null;
 if(numbered){
 if(!a.permissions.view)throw Error('Sem permissão para consultar.');
 const deleting=/^(excl|remov)/i.test(numbered[1]),permission=deleting?'delete':'edit';if(!a.permissions[permission])throw Error('Sem permissão para '+(deleting?'excluir':'editar')+' itens.');
 const savedView=await db.prepare('SELECT value FROM settings WHERE key=?').bind(listKey).first();const view=savedView?JSON.parse(savedView.value):null;
 if(!view||view.user!==a.user||view.family!==a.family||view.expires<Date.now())throw Error('Peça a lista de compras antes de informar o número do produto.');
 const records=await getRecords();const reference=view.items[Number(numbered[2])-1];const row=reference&&records.find((r:any)=>r.kind==='shoppingItem'&&r.id===reference.id);
 if(row?.autoStock)throw Error('Esta reposição acompanha o estoque. Ajuste a quantidade ou o padrão na aba Estoque da Mar IA.');
 if(!row)throw Error('Esse produto não está disponível. Peça a lista de compras atualizada.');
 if(signature(row)!==reference.signature)throw Error('Esse produto foi alterado. Peça a lista de compras atualizada antes de editar ou excluir.');
 if(deleting){await reply(`Produto ${numbered[2]} excluído: ${row.name}.`,buttons([[button('Lista de compras','mi:shopping')]]),[clear,{sql:'DELETE FROM records WHERE id=? AND family=? AND kind=\'shoppingItem\' AND $GUARD',args:[row.id,a.family]}],'delete');return true;}
 await reply(`Editar produto ${numbered[2]}: ${row.name} · ${row.quantity} ${row.unit}\nEnvie os novos dados, por exemplo: 3 kg de arroz.`,back,[save({step:'shopping-edit',id:row.id,signature:signature(row),number:Number(numbered[2])})],'edit');return true;
 }
 if(cb?.startsWith('mi:check:')){
 if(!a.permissions.view||!a.permissions.edit)throw Error('Sem permissão para marcar produtos.');
 const records=await getRecords();const match=cb.match(/^mi:check:([01]):(.+)$/);const row=match&&records.find((r:any)=>r.kind==='shoppingItem'&&r.id===match[2]);if(!row)throw Error('Produto indisponível. Peça a lista atualizada.');
 const {id,kind,...data}=row;const bought=match![1]==='1';
 const updated=records.map((r:any)=>r.id===row.id?{...r,bought}:r);const ordered=updated.filter((r:any)=>r.kind==='shoppingItem'&&(!r.autoStock||a.permissions.stock!==false)).sort((x:any,y:any)=>x.id.localeCompare(y.id));const page=Math.floor(ordered.findIndex((r:any)=>r.id===row.id)/20)+1;
 await list(page,updated,[{sql:row.autoStock?"INSERT INTO records(id,family,kind,data,author) SELECT ?,?,'shoppingItem',?,? WHERE $GUARD ON CONFLICT(id) DO UPDATE SET data=excluded.data WHERE records.family=excluded.family":'UPDATE records SET data=? WHERE id=? AND family=? AND kind=\'shoppingItem\' AND $GUARD',args:row.autoStock?[id,a.family,JSON.stringify({...data,bought,purchasedQuantity:bought?row.quantity:0}),a.email]:[JSON.stringify({...data,bought,purchasedQuantity:bought?row.quantity:0}),id,a.family]}],'edit');return true;
 }
 const requested=!cb&&m.type==='text'?(shoppingIntent(input)??(!flow&&/^\d+(?:[.,]\d+)?\s+.+,.+/.test(input)?input:null)):null;
 const itemSummary=(items:any[])=>items.map(data=>`${data.name} · ${data.quantity} ${data.unit}`).join('\n');
 const itemRows=(items:any[])=>items.map((data,i)=>({id:'tg-shop-'+event.id+(i?'-'+i:''),kind:'shoppingItem',data}));
 if(requested!==null){if(!a.permissions.add)throw Error('Sem permissão para adicionar itens.');const items=parseShoppingBatch(requested);await reply(`Adicionado à lista:\n${itemSummary(items)}`,buttons([[button('Adicionar outro','mi:add'),button('Lista de compras','mi:shopping')],[button('Voltar ao menu','mi:menu')]]),[clear],'add',itemRows(items));return true;}
 if(cb==='mi:add'){
 if(!a.permissions.add)throw Error('Sem permissão.');
 await reply('Envie os produtos separados por vírgula: 2 arroz, 2 feijão. Também aceita: 1,5 kg de arroz, 2 litros de leite.',back,[save({step:'shopping'})],'add');return true;}
 if(cb?.startsWith('mi:edit:')||cb?.startsWith('mi:toggle:')){await reply('Este botão não está mais disponível.',buttons([[button('Lista de compras','mi:shopping')]]),[clear]);return true;}
 if(cb?.startsWith('mi:delete:')){await reply('Para excluir, peça a lista atualizada e envie: excluir o produto 1.',buttons([[button('Lista de compras','mi:shopping')]]));return true;}
 if(cb==='mi:report'){if(!a.permissions.view)throw Error('Sem permissão para consultar.');await reply('Abra seus relatórios financeiros:',buttons([[{text:'Abrir relatórios',web_app:{url:'https://financas-familia-robson.merryscout8.chatgpt.site/telegram/reports'}}],[button('Voltar ao menu','mi:menu')]]));return true;}
 if(cb&&['mi:balance','mi:movements','mi:report'].includes(cb))return false;
 if(!flow)return false;
 if(flow.step==='shopping-edit'&&!cb){
 if(!a.permissions.view||!a.permissions.edit)throw Error('Sem permissão para editar produtos.');
 const records=await getRecords();const row=records.find((r:any)=>r.kind==='shoppingItem'&&r.id===flow.id);if(!row||signature(row)!==flow.signature)throw Error('Produto alterado ou removido. Peça a lista atualizada e selecione novamente.');
 if(row.autoStock)throw Error('Ajuste esta reposição na aba Estoque da Mar IA.');const items=parseShoppingBatch(input);if(items.length!==1)throw Error('Edite um produto por vez. Exemplo: 3 kg de arroz.');
 const {id,kind,...data}=row;const changed={...data,...items[0],bought:row.bought===true};
 await reply(`Produto ${flow.number} atualizado: ${changed.name} · ${changed.quantity} ${changed.unit}`,buttons([[button('Lista de compras','mi:shopping')]]),[clear,{sql:'UPDATE records SET data=? WHERE id=? AND family=? AND kind=\'shoppingItem\' AND $GUARD',args:[JSON.stringify(changed),id,a.family]}],'edit');return true;
 }
 if(flow.step==='shopping'&&!cb){if(flow.id){await reply('A edição pelo Telegram foi removida. Use Adicionar item para incluir produtos.',buttons([[button('Adicionar item','mi:add')],[button('Lista de compras','mi:shopping')]]),[clear]);return true;}const items=parseShoppingBatch(input);if(!a.permissions.add)throw Error('Sem permissão.');await reply(`Itens salvos:\n${itemSummary(items)}`,buttons([[button('Adicionar outro','mi:add'),button('Lista de compras','mi:shopping')]]),[clear],'add',itemRows(items));return true;}
 if(!a.permissions.add)throw Error('Sem permissão para registrar.');
 if(flow.step==='amount'&&!cb){if(!/^\d+(?:[.,]\d{1,2})?$/.test(input)||Number(input.replace(',','.'))<=0)throw Error('Informe um valor positivo, como 32,50.');flow={...flow,amount:Number(input.replace(',','.')),step:'payment'};const records=await getRecords();const methods=[...new Set([...paymentMethods,...records.filter((r:any)=>r.kind==='paymentMethod'&&!isRemovedPaymentMethod(r.name)).map((r:any)=>r.name)])];await reply(flow.type==='income'?'Como você recebeu?':'Qual é a forma de pagamento?',buttons(methods.map((name:any,i)=>[button(name,'mi:pay:'+i)])),[save({...flow,methods})],'add');return true;}
 if(flow.step==='payment'&&cb?.startsWith('mi:pay:')){const method=flow.methods[Number(cb.slice(7))];if(!method)throw Error('Forma inválida.');const categories=flow.type==='income'?['Salário','Investimentos','Receita fixa','Outros']:['Alimentação','Moradia','Transporte','Saúde','Educação','Lazer','Contas fixas','Outros'];await reply('Escolha uma categoria abaixo ou digite outra no campo de mensagem.',buttons([...categories.map((name:string,i:number)=>[button(name,'mi:category:'+i)]),[button('Voltar ao menu','mi:menu')]]),[save({...flow,paymentMethod:method,categories,step:'category'})],'add');return true;}
 if(flow.step==='category'&&cb?.startsWith('mi:category:')){const index=Number(cb.slice(12));const category=flow.categories?.[index];if(!Number.isSafeInteger(index)||!category)throw Error('Categoria inválida.');await reply('Agora informe uma descrição, por exemplo: Compra no mercado.',back,[save({...flow,category,step:'description'})],'add');return true;} if(flow.step==='category'&&!cb){if(!input||input.length>80)throw Error('Categoria inválida.');await reply('Agora informe uma descrição, por exemplo: Compra no mercado.',back,[save({...flow,category:input,step:'description'})],'add');return true;}
 if(flow.step==='description'&&!cb){if(!input||input.length>120)throw Error('Descrição inválida.');flow={...flow,name:input,step:'confirm'};await reply(`${flow.type==='income'?'Receita':'Despesa'}: R$ ${flow.amount.toFixed(2)}\n${flow.paymentMethod}\n${flow.category} · ${flow.name}\nData: ${new Date().toISOString().slice(0,10)}`,buttons([[button('Confirmar','mi:confirm:'+flow.id)],[button('Cancelar','mi:menu')]]),[save(flow)],'add');return true;}
 if(flow.step==='confirm'&&cb==='mi:confirm:'+flow.id){const data={type:flow.type,amount:flow.amount,paymentMethod:flow.paymentMethod,category:flow.category,name:flow.name,date:new Date().toISOString().slice(0,10),paid:true,source:'telegram',waMessageId:flow.id};await reply('Lançamento registrado.',buttons([[button('Lançar outra','mi:'+flow.type)],[button('Voltar ao menu','mi:menu')]]),[clear],'add',[{id:'tg-interactive-'+flow.id,kind:'transaction',data}]);return true;}
 if(cb)throw Error('Este botão expirou. Envie /menu para continuar.');return false;
}
