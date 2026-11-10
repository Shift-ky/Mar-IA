'use client';
import {useMemo,useState,useEffect,useRef} from 'react';
import {CalendarDays,Wallet,ArrowUpRight,TrendingUp,ChevronRight} from 'lucide-react';
import {Area,Bar,BarChart,CartesianGrid,Cell,ComposedChart,Line,Pie,PieChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import {dashboardSummary} from '../lib/dashboard-summary';
import {walletNames,walletsForDisplay,walletDefinition} from '../lib/wallets';
import {type DashboardPreferences,type DashboardWidget} from '../lib/dashboard-preferences';
const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
const labels:Record<string,string>={'Dinheiro':'Dinheiro','Vale-alimentação':'Alimentação','Vale-refeição':'Refeição','Combustível':'Combustível'};
const chartColors=['#3b82f6','#f97316','#22c55e','#a855f7','#ef4444','#14b8a6','#eab308','#ec4899','#64748b','#06b6d4'];
const monthLabel=(value:string)=>{const [year,month]=value.split('-').map(Number);return new Date(year,month-1,1).toLocaleDateString('pt-BR',{month:'short'}).replace('.','');};
function FitMoney({value}:{value:number}){
 const ref=useRef<HTMLElement>(null),text=money(value);
 useEffect(()=>{
  const el=ref.current;if(!el)return;
  let active=true;
  const fit=()=>{
   if(!active||!el.clientWidth)return;
   el.style.fontSize='';
   el.style.whiteSpace='nowrap';
   const base=parseFloat(getComputedStyle(el).fontSize);
   const width=el.clientWidth,needed=el.scrollWidth;
   if(needed>width)el.style.fontSize=Math.max(10,Math.floor(base*(width-1)/needed*10)/10)+'px';
   if(el.scrollWidth>width)el.style.whiteSpace='normal';
  };
  fit();
  const observer=new ResizeObserver(fit);observer.observe(el);
  void document.fonts?.ready.then(fit);
  return()=>{active=false;observer.disconnect();};
 },[text]);
 return <strong className="dashboard-box-value" ref={ref}>{text}</strong>;
}
export default function AnalyticsDashboard({snapshot,month,onMonthChange,onGoals,snapshotPreferences,onPreferencesChange,syncState,error}:{snapshot:any;month:string;onMonthChange:(value:string)=>void;onGoals:()=>void;snapshotPreferences:DashboardPreferences;onPreferencesChange:(value:DashboardPreferences)=>void;onPurchases?:()=>void;onEditPurchase?:(record:any)=>void;syncState?:string;error?:string}){
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'}),reference=month>today.slice(0,7)?today.slice(0,7):month;
 const data=useMemo(()=>dashboardSummary(snapshot?.records||[],reference,today),[snapshot?.records,reference,today]);
 const [rates,Rates]=useState<Record<string,{rate:number;date:string}>>({});
 const foreignKey=walletsForDisplay(snapshot?.records||[]).map(name=>walletDefinition(snapshot?.records||[],name).currency).filter(currency=>currency!=='BRL').join(',');
 useEffect(()=>{if(!foreignKey)return;let active=true;try{Rates(JSON.parse(localStorage.getItem('mar-ia-fx')||'{}'))}catch{}const update=()=>{if(!navigator.onLine)return;void fetch('/api/exchange-rates').then(r=>{if(!r.ok)throw Error();return r.json()}).then(d=>{if(active)Rates(d.rates);localStorage.setItem('mar-ia-fx',JSON.stringify(d.rates))}).catch(()=>{});};update();window.addEventListener('online',update);const timer=setInterval(update,3600000);return()=>{active=false;clearInterval(timer);window.removeEventListener('online',update)}},[foreignKey]);
 const preferences=snapshotPreferences;
 const active=preferences.views.find(view=>view.id===preferences.activeId)||preferences.views[0];
 const tooltip={background:'var(--card-strong)',border:'1px solid var(--border)',borderRadius:10,color:'var(--text)',fontSize:12};
 const monthlyFlow=useMemo(()=>{const [y,m]=reference.split('-').map(Number);return Array.from({length:6},(_,index)=>{const d=new Date(y,m-1-(5-index),1),key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;const rows=(snapshot?.records||[]).filter((r:any)=>r.kind==='transaction'&&r.paid&&!r.voided&&r.date?.startsWith(key));return {month:monthLabel(key),Entradas:rows.filter((r:any)=>r.type==='income').reduce((n:number,r:any)=>n+Number(r.amount||0),0),Saídas:rows.filter((r:any)=>r.type==='expense').reduce((n:number,r:any)=>n+Number(r.amount||0),0)};});},[snapshot?.records,reference]);
 if(!snapshot?.permissions?.view)return <section className="panel analytics-empty"><Wallet/><h2>Sem acesso aos dados da família</h2></section>;
 function selectView(id:string){onPreferencesChange({...preferences,activeId:id});}
 function renderWidget(widget:DashboardWidget){
  const title=widget.title||'Caixa do painel';
  const value=widget.source==='balance'?data.balance:widget.source==='income'?data.received:widget.source==='expenses'?data.paidExpenses:widget.source==='bills'?data.bills:widget.source==='forecast'?data.forecast:null;
  const captions:Record<string,string>={balance:`Saldo confirmado até ${data.cutoff.split('-').reverse().join('/')}`,income:'Receitas recebidas no mês',expenses:'Somente despesas pagas',bills:'Contas e pendências do mês',forecast:'Saldo + entradas previstas − contas'};
  const common={className:`dashboard-box dashboard-box-${widget.height}`,style:{'--box-accent':widget.color||'var(--accent)','--box-min-height':widget.height==='large'?'340px':widget.height==='medium'?'190px':'128px','--box-span':String(widget.width)} as any};
  if(value!==null)return <article {...common}><div className="dashboard-box-heading"><h3>{title}</h3>{widget.source==='balance'?<Wallet size={17}/>:widget.source==='expenses'?<ArrowUpRight size={17}/>:widget.source==='forecast'?<TrendingUp size={17}/>:<CalendarDays size={17}/>}</div><FitMoney value={value}/><small>{captions[widget.source]}</small></article>;
  if(widget.source==='categories')return <article {...common}><div className="dashboard-box-heading"><div><h3>{title}</h3><small>Despesas pagas por categoria</small></div></div>{data.categories.length?<div className="dashboard-category-layout"><div className="dashboard-donut"><ResponsiveContainer width="100%" height="100%">{widget.chart==='bars'?<ComposedChart data={data.categories.slice(0,8)} layout="vertical" margin={{left:2,right:5,top:5,bottom:5}}><CartesianGrid stroke="var(--chart-grid)" horizontal={false}/><XAxis type="number" hide/><YAxis type="category" dataKey="name" width={78} tick={{fill:'var(--muted)',fontSize:8}} tickLine={false} axisLine={false}/><Tooltip formatter={(v:any)=>money(Number(v))} contentStyle={tooltip}/><Bar dataKey="value" radius={[0,4,4,0]}>{data.categories.slice(0,8).map((_:any,i:number)=><Cell key={i} fill={chartColors[i%chartColors.length]}/>)}</Bar></ComposedChart>:<PieChart><Pie data={data.categories} dataKey="value" nameKey="name" innerRadius={widget.chart==='donut'?48:0} outerRadius="82%" paddingAngle={2}>{data.categories.map((_:any,i:number)=><Cell key={i} fill={chartColors[i%chartColors.length]}/>)}</Pie><Tooltip formatter={(v:any)=>money(Number(v))} contentStyle={tooltip}/></PieChart>}</ResponsiveContainer></div><div className="dashboard-category-legend">{data.categories.map((category:any,i:number)=><div key={category.name}><span><i style={{background:chartColors[i%chartColors.length]}}/>{category.name}</span><strong>{money(category.value)}</strong></div>)}</div></div>:<div className="dashboard-widget-empty">Nenhuma despesa paga neste mês.</div>}</article>;
  if(widget.source==='cashflow'){const chart=widget.chart==='bars'?<BarChart data={monthlyFlow} margin={{top:8,right:8,bottom:0,left:0}}><CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="month" tick={{fill:'var(--muted)',fontSize:10}} tickLine={false} axisLine={false}/><YAxis tickFormatter={n=>Number(n).toLocaleString('pt-BR',{notation:'compact'})} width={42} tick={{fill:'var(--muted)',fontSize:9}} tickLine={false} axisLine={false}/><Tooltip formatter={(v:any)=>money(Number(v))} contentStyle={tooltip}/><Bar dataKey="Entradas" fill="#22c55e" radius={[4,4,0,0]}/><Bar dataKey="Saídas" fill="#ef4444" radius={[4,4,0,0]}/></BarChart>:<ComposedChart data={monthlyFlow} margin={{top:8,right:8,bottom:0,left:0}}><CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="month" tick={{fill:'var(--muted)',fontSize:10}} tickLine={false} axisLine={false}/><YAxis tickFormatter={n=>Number(n).toLocaleString('pt-BR',{notation:'compact'})} width={42} tick={{fill:'var(--muted)',fontSize:9}} tickLine={false} axisLine={false}/><Tooltip formatter={(v:any)=>money(Number(v))} contentStyle={tooltip}/>{widget.chart==='line'?<><Line dataKey="Entradas" stroke="#22c55e" strokeWidth={2}/><Line dataKey="Saídas" stroke="#ef4444" strokeWidth={2}/></>:<><Area dataKey="Entradas" stroke="#22c55e" fill="#22c55e" fillOpacity={.15}/><Area dataKey="Saídas" stroke="#ef4444" fill="#ef4444" fillOpacity={.12}/></>}</ComposedChart>;return <article {...common}><div className="dashboard-box-heading"><div><h3>{title}</h3><small>Entradas e saídas dos últimos seis meses</small></div></div>{monthlyFlow.some(row=>row.Entradas||row.Saídas)?<div className="dashboard-flow-chart"><ResponsiveContainer width="100%" height="100%">{chart}</ResponsiveContainer></div>:<div className="dashboard-widget-empty">Ainda não há movimentações registradas.</div>}</article>;}
  if(widget.source==='wallets')return <article {...common}><div className="dashboard-box-heading"><div><h3>{title}</h3><small>Saldo disponível por carteira</small></div></div><div className="dashboard-wallet-list">{walletsForDisplay(snapshot?.records||[]).map((wallet:string)=><div key={wallet}><span>{labels[wallet]||wallet}</span><strong>{Number(data.balances[wallet]||0).toLocaleString('pt-BR',{style:'currency',currency:walletDefinition(snapshot?.records||[],wallet).currency})}{walletDefinition(snapshot?.records||[],wallet).currency!=='BRL'&&<small className="wallet-brl-equivalent">{rates[walletDefinition(snapshot?.records||[],wallet).currency]?<>≈ {money((data.balances[wallet]||0)*rates[walletDefinition(snapshot?.records||[],wallet).currency].rate)} · {rates[walletDefinition(snapshot?.records||[],wallet).currency].date.split('-').reverse().join('/')}</>:'Cotação indisponível'}</small>}</strong></div>)}</div></article>;
  return <article {...common}><div className="dashboard-box-heading"><div><h3>{title}</h3><small>Objetivos da família</small></div><button className="textbutton" onClick={onGoals} aria-label="Abrir metas"><ChevronRight size={17}/></button></div>{data.goals.length?data.goals.slice(0,5).map((goal:any)=><div className="dashboard-goal" key={goal.id}><div><strong>{goal.name}</strong><span>{goal.percent.toLocaleString('pt-BR',{maximumFractionDigits:0})}%</span></div><div className="dashboard-goal-progress"><i style={{width:goal.percent+'%'}}/></div><small>{goal.mode==='limit'?'Gasto':'Guardado'}: {money(goal.progress)} de {money(goal.amount)} · {goal.mode==='limit'?'Disponível':'Faltam'} {money(goal.remaining)}</small></div>):<div className="dashboard-widget-empty">Nenhuma meta cadastrada.</div>}</article>;
 }
 return <div className="analytics-dashboard clean-dashboard customizable-dashboard">
  {error&&<p className="alert" role="alert">{error}</p>}{syncState==='offline'&&<p className="analytics-sync-note">Offline · dados disponíveis neste aparelho.</p>}
  <div className="analytics-heading"><div className="analytics-heading-copy"><p className="eyebrow">VISÃO FINANCEIRA</p><h2>{active?.name||'Painel principal'}</h2><p className="muted">Escolha as informações e a organização que fazem sentido para você.</p></div>{preferences.views.length>1&&<div className="dashboard-header-controls"><div className="dashboard-heading-actions"><label className="dashboard-view-select">Painel<select aria-label="Painel atual" value={active?.id||''} onChange={e=>selectView(e.target.value)}>{preferences.views.map(view=><option key={view.id} value={view.id}>{view.name}</option>)}</select></label></div></div>}</div>

  {active?.sections.map(section=><section className="dashboard-section" key={section.id}><div className="dashboard-section-title"><h3>{section.name}</h3></div><div className="dashboard-section-grid" style={{'--section-columns':section.columns} as any}>{section.widgets.map(widget=><div className="dashboard-widget-wrap" key={widget.id} style={{'--widget-span':Math.min(widget.width,section.columns)} as any}>{renderWidget(widget)}</div>)}</div></section>)}
  {!active?.sections.some(section=>section.widgets.length>0)&&<div className="dashboard-empty"><Wallet/><p>Este painel está vazio. Use Personalizar para adicionar caixas.</p></div>}
 </div>;
}
