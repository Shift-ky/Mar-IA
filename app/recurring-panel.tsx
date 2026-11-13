'use client';
import {useState} from 'react';
import {expenseCategoryGroups,incomeCategories} from '../lib/categories';
import {Plus,X} from 'lucide-react';
import {creditInstallmentPlans} from '../lib/credit-installments';
import {recurringWallets} from '../lib/recurring';
const money=(amount:number)=>amount.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const displayDate=(date:string)=>date.split('-').reverse().join('/');

export default function RecurringPanel({snapshot:s,act}:{snapshot:any,act:(b:any)=>Promise<any>}){
 const [editing,E]=useState<any>(undefined),[noEnd,N]=useState(true),[income,I]=useState(false),[type,T]=useState('expense'),[busy,B]=useState(false),[error,F]=useState('');const rules=s.records.filter((r:any)=>r.kind==='recurringBill'&&!r.disabled);
 const plans=creditInstallmentPlans(s.records);
 const canPay=s.permissions.edit&&(s.admin||s.permissions.sections?.finance!==false);
 async function pay(row:any){
  B(true);
  try{await act({action:'save',kind:'transaction',id:row.id,paymentStatusOnly:true,data:{...row,paid:true}});}
  finally{B(false);}
 }
 function open(r:any=null){E(r);N(!r?.endDate);I(r?.type==='income');T(r?.type||'expense');F('');}
 async function save(e:any){e.preventDefault();B(true);F('');const v=Object.fromEntries(new FormData(e.currentTarget));try{if(await act({action:'save',kind:'recurringBill',id:editing?.id,data:{name:v.name,amount:Number(v.amount),type:v.type,...(v.type!=='transfer'?{paymentMethod:v.paymentMethod,category:v.category}:{}),startDate:v.startDate,endDate:noEnd?null:v.endDate,autoReceive:v.autoReceive==='on'}}))E(undefined);else F('Não foi possível salvar. Confira os dados e a sincronização.');}catch(e:any){F(e.message)}finally{B(false)}}
 return <section className="panel"><div className="sectiontitle"><div><h2>Contas fixas</h2><p>Despesas e receitas mensais, com início, fim ou sem prazo para terminar.</p></div>{s.permissions.add&&<button className="primary" onClick={()=>open()}><Plus size={16}/> Cadastrar conta fixa</button>}</div><p className="muted">As despesas são lançadas automaticamente como contas a pagar. As receitas entram como previstas, ou como recebidas na data se você ativar essa opção. Transferências para gasolina ficam pendentes em Carteiras até sua confirmação, sem contar como despesa. Cada parcela só é lançada na data programada, ao abrir ou sincronizar o aplicativo. Datas futuras permanecem apenas no agendamento.</p>{rules.map((r:any)=><article className="queueitem" key={r.id}><strong>{r.name} · {Number(r.amount).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</strong><p>{r.type==='transfer'?'Transferência Dinheiro → Combustível':r.type==='income'?'Receita':'Despesa'} mensal · início {r.startDate.split('-').reverse().join('/')} · {r.endDate?'fim '+r.endDate.split('-').reverse().join('/'):'sem data final'}</p>{r.type!=='transfer'&&<small>Carteira: {r.paymentMethod||'Dinheiro'} · Categoria: {r.category||(r.type==='income'?'Receita fixa':'Contas fixas')}</small>}{r.autoReceive&&<small>Recebimento confirmado automaticamente na data cadastrada.</small>}{(s.permissions.edit||s.permissions.delete)&&<details className="recurring-account-options">
  <summary>Opções da conta</summary>
  <div className="actions">
   {s.permissions.edit&&<button type="button" onClick={()=>open(r)}>Editar</button>}
   {s.permissions.delete&&<button type="button" onClick={()=>{void act({action:'delete',id:r.id})}}>Excluir conta fixa</button>}
  </div>
 </details>}</article>)}{!rules.length&&!plans.length&&<div className="empty">Cadastre aluguel, internet, salário ou outra movimentação mensal.</div>}
 {plans.length>0&&<section aria-labelledby="credit-installments-title">
  <h3 id="credit-installments-title">Compras parceladas no crédito</h3>
  {plans.map(plan=>{
   const paid=plan.installments.filter(row=>row.paid).length;
   const open=plan.installments.filter(row=>!row.paid);
   const outstanding=open.reduce((sum,row)=>sum+Math.round(Number(row.amount)*100),0)/100;
   return <article className="queueitem" key={plan.id}>
    <strong>{plan.name}</strong>
    <p>{plan.installments[0].wallet||plan.installments[0].paymentMethod} · {plan.count} parcelas · {paid} pagas</p>
    {open.length>0&&<p>Em aberto {money(outstanding)} · Próximo vencimento {displayDate(open[0].date)}</p>}
    <details className="recurring-account-options">
     <summary>Ver parcelas</summary>
     {plan.installments.map(row=><div className="forecastline" key={row.id}>
      <span>Parcela {row.installmentIndex+1}/{plan.count}<small> · {displayDate(row.paidAt||row.date)}</small></span>
      <strong>{money(Number(row.amount))}</strong>
      {row.paid?<span className="badge paid">Paga</span>:canPay?<button type="button" disabled={busy} onClick={()=>void pay(row)}>Marcar como pago</button>:<span className="badge pending">Em aberto</span>}
     </div>)}
    </details>
   </article>;
  })}
 </section>}
 {editing!==undefined&&<div className="overlay"><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="recurring-title"><div className="sectiontitle"><h2 id="recurring-title">{editing?'Editar conta fixa':'Nova conta fixa'}</h2><button disabled={busy} aria-label="Fechar" onClick={()=>E(undefined)}><X/></button></div><form onSubmit={save}>{error&&<p className="alert" role="alert">{error}</p>}<label>Descrição<input name="name" required maxLength={120} defaultValue={editing?.name||''}/></label><div className="formgrid"><label>Valor (R$)<input name="amount" type="number" required min="0.01" step="0.01" defaultValue={editing?.amount||''}/></label><label>Tipo<select name="type" value={type} onChange={e=>{T(e.target.value);I(e.target.value==='income')}}><option value="expense">Despesa mensal</option><option value="income">Receita mensal</option><option value="transfer">Transferência Dinheiro → Combustível (gasolina)</option></select></label></div>{type!=='transfer'&&<label>Categoria<select name="category" key={type} required defaultValue={editing?.type===type?(editing.category||(type==='income'?'Receita fixa':'Contas fixas')):'Outros'}>{editing?.type===type&&editing.category&&<option value={editing.category}>{editing.category}</option>}{type==='income'?<><option value="Receita fixa">Receita fixa</option>{incomeCategories.map(category=><option key={category} value={category}>{category}</option>)}</>:<><option value="Contas fixas">Contas fixas</option>{expenseCategoryGroups.map(group=><optgroup key={group.name} label={group.name}>{group.items.map(category=><option key={category} value={category}>{category}</option>)}</optgroup>)}</>}</select></label>}<label>Data inicial / primeiro vencimento<input name="startDate" type="date" required defaultValue={editing?.startDate||new Date().toLocaleDateString('en-CA')}/></label><label className="checkbox"><input type="checkbox" checked={noEnd} onChange={e=>N(e.target.checked)}/> Esta conta não tem data final</label>{!noEnd&&<label>Data final<input name="endDate" type="date" required defaultValue={editing?.endDate||''}/></label>}{type!=='transfer'&&<label>Carteira<select name="paymentMethod" key={type} required defaultValue={(editing?.type===type&&editing.paymentMethod)||'Dinheiro'}>{recurringWallets(s.records,type).map((wallet:string)=><option key={wallet} value={wallet}>{wallet}</option>)}</select></label>}{income&&<label className="checkbox"><input name="autoReceive" type="checkbox" defaultChecked={editing?.autoReceive===true}/> Marcar como recebida automaticamente na data prevista</label>}<p className="muted">O vencimento se repete mensalmente no dia da data inicial. Em meses mais curtos, será usado o último dia do mês. Alterações valem para parcelas futuras ainda pendentes.</p><button className="primary submit" disabled={busy}>{busy?'Salvando…':'Salvar conta fixa'}</button></form></section></div>}</section>
}
