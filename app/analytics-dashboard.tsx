'use client';

import {useMemo,useState,useEffect,useRef,type CSSProperties} from 'react';
import {CalendarDays,Wallet,ArrowUpRight,TrendingUp,ChevronRight} from 'lucide-react';
import {Area,Bar,BarChart,CartesianGrid,Cell,ComposedChart,Line,Pie,PieChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import {dashboardSummary} from '../lib/dashboard-summary';
import {walletNames,walletsForDisplay,walletDefinition} from '../lib/wallets';
import {goalChart,type DashboardPreferences,type DashboardWidget} from '../lib/dashboard-preferences';
const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
const labels:Record<string,string>={'Dinheiro':'Dinheiro','Vale-alimentação':'Alimentação','Vale-refeição':'Refeição','Combustível':'Combustível'};
const chartColors=['#3b82f6','#f97316','#22c55e','#a855f7','#ef4444','#14b8a6','#eab308','#ec4899','#64748b','#06b6d4'];
const monthLabel=(value:string)=>{const [year,month]=value.split('-').map(Number);return new Date(year,month-1,1).toLocaleDateString('pt-BR',{month:'short'}).replace('.','');};
const percentFormat = new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2});
type Goal = ReturnType<typeof dashboardSummary>['goals'][number];
function GoalProgress({goal,chart}:{goal:Goal;chart:ReturnType<typeof goalChart>}){
 const limit=goal.mode==='limit';
 const percent=goal.amount>0?Math.max(0,goal.progress/goal.amount*100):0;
 const progressText=percent>0&&percent<0.01?'< 0,01%':percentFormat.format(percent)+'%';
 const style={'--goal-progress':Math.min(100,percent)+'%'} as CSSProperties;
 return <section className={`goal-report-item goal-report-${chart}${limit&&percent>100?' goal-report-over':''}`}>
  <div className="goal-report-label"><h4>{goal.name}</h4><strong>{progressText}</strong></div>
  <div className="goal-report-plot" style={style} aria-hidden="true"><span/></div>
  <dl className="goal-report-values">
   <div><dt>{limit?'Gasto':'Guardado'}</dt><dd>{money(goal.progress)}</dd></div>
   <div><dt>{limit?'Limite':'Meta'}</dt><dd>{money(goal.amount)}</dd></div>
   <div><dt>{limit?(percent>100?'Acima do limite':'Disponível'):'Falta guardar'}</dt><dd>{money(limit&&percent>100?goal.progress-goal.amount:goal.remaining)}</dd></div>
  </dl>
 </section>;
}

function gridStarts(spans:number[],columns:number){
 let occupied=0;
 return spans.map((span,index)=>{
  const next=spans[index+1],following=spans[index+2];
  const keepNextPair=next+following===columns&&next>span;
  if(occupied+span>columns||columns===4&&occupied>0&&span+next===columns&&!keepNextPair)occupied=0;
  const start=occupied+1;
  occupied=(occupied+span)%columns;
  return start;
 });
}

function FitMoney({value,currency='BRL'}:{value:number;currency?:string}){
 const ref=useRef<HTMLElement>(null),text=value.toLocaleString('pt-BR',{style:'currency',currency});
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
 const [rates,Rates]=useState<Record<string,{rate:number;date:string}>>({});
 const data=useMemo(()=>dashboardSummary(snapshot?.records||[],reference,today,rates),[snapshot?.records,reference,today,rates]);
 const foreignKey=walletsForDisplay(snapshot?.records||[]).map(name=>walletDefinition(snapshot?.records||[],name).currency).filter(currency=>currency!=='BRL').join(',');
 useEffect(()=>{if(!foreignKey)return;let active=true;try{Rates(JSON.parse(localStorage.getItem('mar-ia-fx')||'{}'))}catch{}const update=()=>{if(!navigator.onLine)return;void fetch('/api/exchange-rates').then(r=>{if(!r.ok)throw Error();return r.json()}).then(d=>{if(active)Rates(d.rates);localStorage.setItem('mar-ia-fx',JSON.stringify(d.rates))}).catch(()=>{});};update();window.addEventListener('online',update);const timer=setInterval(update,3600000);return()=>{active=false;clearInterval(timer);window.removeEventListener('online',update)}},[foreignKey]);
 const preferences=snapshotPreferences;
 const active=preferences.views.find(view=>view.id===preferences.activeId)||preferences.views[0];
 const sectionStarts=gridStarts(active?.sections.map(section=>section.columns)||[],4);
 const tooltip={background:'var(--card-strong)',border:'1px solid var(--border)',borderRadius:10,color:'var(--text)',fontSize:12};
 const monthlyFlow=useMemo(()=>{const [y,m]=reference.split('-').map(Number);return Array.from({length:6},(_,index)=>{const d=new Date(y,m-1-(5-index),1),key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;const rows=(snapshot?.records||[]).filter((r:any)=>r.kind==='transaction'&&r.paid&&!r.voided&&r.date?.startsWith(key));return {month:monthLabel(key),Entradas:rows.filter((r:any)=>r.type==='income').reduce((n:number,r:any)=>n+Number(r.amount||0),0),Saídas:rows.filter((r:any)=>r.type==='expense').reduce((n:number,r:any)=>n+Number(r.amount||0),0)};});},[snapshot?.records,reference]);
 if(!snapshot?.permissions?.view)return <section className="panel analytics-empty"><Wallet/><h2>Sem acesso aos dados da família</h2></section>;
 function selectView(id:string){onPreferencesChange({...preferences,activeId:id});}
 function renderWidget(widget:DashboardWidget){
  const title=widget.title||'Caixa do painel';
  const balanceValues={cash:data.cashBalance,benefits:data.benefitsBalance,credit:data.creditBalance};
  const balanceValue=widget.balanceScope?balanceValues[widget.balanceScope]:data.balance;
  const balanceLabels={cash:'Dinheiro',benefits:'Benefícios',credit:'Limite de crédito disponível'};
  const balanceCaption=widget.balanceScope==='credit'?balanceLabels.credit:`${widget.balanceScope?balanceLabels[widget.balanceScope]:'Saldo confirmado'} até ${data.cutoff.split('-').reverse().join('/')}`;
  const value=widget.source==='balance'?balanceValue:widget.source==='income'?data.received:widget.source==='expenses'?data.paidExpenses:widget.source==='bills'?data.bills:widget.source==='forecast'?data.forecast:null;
  const captions:Record<string,string>={balance:balanceCaption,income:'Receitas recebidas no mês',expenses:'Somente despesas pagas',bills:'Contas e pendências do mês',forecast:'Saldo + entradas previstas − contas'};
  const common={className:`dashboard-box dashboard-box-${widget.height}`,style:{'--box-accent':widget.color||'var(--accent)','--box-min-height':widget.height==='large'?(widget.source==='goals'?'250px':'340px'):widget.height==='medium'?'190px':'128px','--box-span':String(widget.width)} as any};
  if(value!==null)return <article {...common}><div className="dashboard-box-heading"><h3>{title}</h3>{widget.source==='balance'?<Wallet size={17}/>:widget.source==='expenses'?<ArrowUpRight size={17}/>:widget.source==='forecast'?<TrendingUp size={17}/>:<CalendarDays size={17}/>}</div><FitMoney value={value}/><small>{captions[widget.source]}</small></article>;
  if(widget.source==='categories')return <article {...common}><div className="dashboard-box-heading"><div><h3>{title}</h3><small>Despesas pagas por categoria</small></div></div>{data.categories.length?<div className="dashboard-category-layout"><div className="dashboard-donut"><ResponsiveContainer width="100%" height="100%">{widget.chart==='bars'?<ComposedChart data={data.categories.slice(0,8)} layout="vertical" margin={{left:2,right:5,top:5,bottom:5}}><CartesianGrid stroke="var(--chart-grid)" horizontal={false}/><XAxis type="number" hide/><YAxis type="category" dataKey="name" width={78} tick={{fill:'var(--muted)',fontSize:8}} tickLine={false} axisLine={false}/><Tooltip formatter={(v:any)=>money(Number(v))} contentStyle={tooltip}/><Bar dataKey="value" radius={[0,4,4,0]}>{data.categories.slice(0,8).map((_:any,i:number)=><Cell key={i} fill={chartColors[i%chartColors.length]}/>)}</Bar></ComposedChart>:<PieChart><Pie data={data.categories} dataKey="value" nameKey="name" innerRadius={widget.chart==='donut'?'53%':0} outerRadius="96%" paddingAngle={2}>{data.categories.map((_:any,i:number)=><Cell key={i} fill={chartColors[i%chartColors.length]}/>)}</Pie><Tooltip formatter={(v:any)=>money(Number(v))} contentStyle={tooltip}/></PieChart>}</ResponsiveContainer></div><div className="dashboard-category-legend">{data.categories.map((category:any,i:number)=><div key={category.name}><span><i style={{background:chartColors[i%chartColors.length]}}/>{category.name}</span><strong>{money(category.value)}</strong></div>)}</div></div>:<div className="dashboard-widget-empty">Nenhuma despesa paga neste mês.</div>}</article>;
  if(widget.source==='cashflow'){const chart=widget.chart==='bars'?<BarChart data={monthlyFlow} margin={{top:8,right:8,bottom:0,left:0}}><CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="month" tick={{fill:'var(--muted)',fontSize:10}} tickLine={false} axisLine={false}/><YAxis tickFormatter={n=>Number(n).toLocaleString('pt-BR',{notation:'compact'})} width={42} tick={{fill:'var(--muted)',fontSize:9}} tickLine={false} axisLine={false}/><Tooltip formatter={(v:any)=>money(Number(v))} contentStyle={tooltip}/><Bar dataKey="Entradas" fill="#22c55e" radius={[4,4,0,0]}/><Bar dataKey="Saídas" fill="#ef4444" radius={[4,4,0,0]}/></BarChart>:<ComposedChart data={monthlyFlow} margin={{top:8,right:8,bottom:0,left:0}}><CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="month" tick={{fill:'var(--muted)',fontSize:10}} tickLine={false} axisLine={false}/><YAxis tickFormatter={n=>Number(n).toLocaleString('pt-BR',{notation:'compact'})} width={42} tick={{fill:'var(--muted)',fontSize:9}} tickLine={false} axisLine={false}/><Tooltip formatter={(v:any)=>money(Number(v))} contentStyle={tooltip}/>{widget.chart==='line'?<><Line dataKey="Entradas" stroke="#22c55e" strokeWidth={2}/><Line dataKey="Saídas" stroke="#ef4444" strokeWidth={2}/></>:<><Area dataKey="Entradas" stroke="#22c55e" fill="#22c55e" fillOpacity={.15}/><Area dataKey="Saídas" stroke="#ef4444" fill="#ef4444" fillOpacity={.12}/></>}</ComposedChart>;return <article {...common}><div className="dashboard-box-heading"><div><h3>{title}</h3><small>Entradas e saídas dos últimos seis meses</small></div></div>{monthlyFlow.some(row=>row.Entradas||row.Saídas)?<div className="dashboard-flow-chart"><ResponsiveContainer width="100%" height="100%">{chart}</ResponsiveContainer></div>:<div className="dashboard-widget-empty">Ainda não há movimentações registradas.</div>}</article>;}
  if(widget.source==='wallets'){
  const records=snapshot?.records||[],compact=widget.walletLayout==='compact';
  return <section {...common} className={compact?common.className:`${common.className} dashboard-wallet-section`}>
   <div className="dashboard-box-heading"><div><h3>{title}</h3>{compact&&<small>Saldo disponível por carteira</small>}</div></div>
   <div className={compact?'dashboard-wallet-list':'dashboard-wallet-list dashboard-wallet-cards'} style={widget.walletColumns?{gridTemplateColumns:`repeat(${widget.walletColumns}, minmax(0, 1fr))`}:undefined}>
    {walletsForDisplay(records).map(wallet=>{
     const definition=walletDefinition(records,wallet),currency=definition.currency,value=Number(data.balances[wallet]||0),name=labels[wallet]||wallet,quote=rates[currency];
     const conversion=currency!=='BRL'&&<small className="wallet-brl-equivalent">{quote?`≈ ${money(value*quote.rate)} · ${quote.date.split('-').reverse().join('/')}`:'Cotação indisponível'}</small>;
     if(compact)return <div key={wallet}><span>{name}</span><strong>{value.toLocaleString('pt-BR',{style:'currency',currency})}{conversion}</strong></div>;
     return <article key={wallet} className="dashboard-box" style={definition.color?{'--box-accent':definition.color} as CSSProperties:undefined}>
      <div className="dashboard-box-heading"><h3>{name}</h3><Wallet size={17}/></div>
      <FitMoney value={value} currency={currency}/>
      {conversion||<small>{definition.type==='credito'?'Limite disponível':`Saldo até ${data.cutoff.split('-').reverse().join('/')}`}</small>}
     </article>;
    })}
   </div>
  </section>;
 }
  const chart=goalChart(widget.chart);
  return <article {...common} className={common.className+' goal-report'}>
   <div className="dashboard-box-heading">
    <h3>{title}</h3>
    <button type="button" className="textbutton" onClick={onGoals}>Abrir metas <ChevronRight size={16}/></button>
   </div>
   {data.goals.length>0?<>
    <div className="goal-report-list">{data.goals.map(goal=><GoalProgress key={goal.id} goal={goal} chart={chart}/>)}</div>
   </>:<div className="dashboard-widget-empty">Nenhuma meta cadastrada.</div>}
  </article>;
 }
 return <div className="analytics-dashboard clean-dashboard customizable-dashboard">
  {error&&<p className="alert" role="alert">{error}</p>}{syncState==='offline'&&<p className="analytics-sync-note">Offline · dados disponíveis neste aparelho.</p>}
  <div className="analytics-heading"><div className="analytics-heading-copy"><p className="eyebrow">VISÃO FINANCEIRA</p><h2>{active?.name||'Painel principal'}</h2><p className="muted">Escolha as informações e a organização que fazem sentido para você.</p></div>{preferences.views.length>1&&<div className="dashboard-header-controls"><div className="dashboard-heading-actions"><label className="dashboard-view-select">Painel<select aria-label="Painel atual" value={active?.id||''} onChange={e=>selectView(e.target.value)}>{preferences.views.map(view=><option key={view.id} value={view.id}>{view.name}</option>)}</select></label></div></div>}</div>

  <div className="dashboard-sections">{active?.sections.map((section,index)=>{
   const hasThreeAndOne=section.widgets.some((widget,i)=>{
    const next=section.widgets[i+1];
    return next&&widget.width+next.width===4&&Math.max(widget.width,next.width)===3;
   });
   const columns=hasThreeAndOne?4:section.columns;
   const spans=section.widgets.map(widget=>Math.min(widget.width,columns));
   const starts=gridStarts(spans,columns);
   let row=0;
   const rows=starts.map(start=>start===1?++row:row);
   return <section className="dashboard-section" key={section.id} style={{'--section-span':section.columns,'--section-start':sectionStarts[index]} as CSSProperties}>
    <div className="dashboard-section-title"><h3>{section.name}</h3></div>
    <div className="dashboard-section-grid" style={{'--section-columns':columns,minHeight:section.widgets.length?section.height:undefined} as CSSProperties}>
     {section.widgets.map((widget,widgetIndex)=><div className="dashboard-widget-wrap" key={widget.id} style={{gridRow:rows[widgetIndex],gridColumn:`${starts[widgetIndex]} / span ${spans[widgetIndex]}`}}>{renderWidget(widget)}</div>)}
    </div>
   </section>;
  })}</div>
  {!active?.sections.some(section=>section.widgets.length>0)&&<div className="dashboard-empty"><Wallet/><p>Este painel está vazio. Use Personalizar para adicionar caixas.</p></div>}
 </div>;
}
