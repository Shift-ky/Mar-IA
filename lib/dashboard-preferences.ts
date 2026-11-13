export type DashboardSource = 'balance'|'income'|'expenses'|'bills'|'forecast'|'categories'|'cashflow'|'wallets'|'goals';
export type DashboardWidget = {id:string;source:DashboardSource;title:string;width:number;height:'compact'|'medium'|'large';color?:string;walletColumns?:number;walletLayout?:'compact';balanceScope?:'cash'|'benefits'|'credit';chart?:'donut'|'pie'|'bars'|'line'|'area'};
export type DashboardSection = {id:string;name:string;columns:number;height?:number;widgets:DashboardWidget[]};
export type DashboardView = {id:string;name:string;sections:DashboardSection[]};
export type DashboardPreferences = {activeId:string;views:DashboardView[];version?:1};

export const dashboardSources:{id:DashboardSource;name:string;description:string}[]=[
 {id:'balance',name:'Saldo disponível',description:'Saldo confirmado nas carteiras.'},
 {id:'income',name:'Entradas do mês',description:'Receitas já recebidas no mês selecionado.'},
 {id:'expenses',name:'Saídas pagas',description:'Despesas pagas no mês selecionado.'},
 {id:'bills',name:'Contas pendentes',description:'Contas a pagar até o fim do mês.'},
 {id:'forecast',name:'Previsão de fechamento',description:'Saldo estimado ao fim do mês.'},
 {id:'categories',name:'Gastos por categoria',description:'Despesas pagas separadas por categoria.'},
 {id:'cashflow',name:'Evolução do saldo',description:'Saldo realizado e previsto ao longo do mês.'},
 {id:'wallets',name:'Saldo por carteira',description:'Saldos das carteiras disponíveis.'},
 {id:'goals',name:'Metas financeiras',description:'Progresso e valores restantes das metas.'},
];
const widget=(id:string,source:DashboardSource,title:string,width:number,height:DashboardWidget['height'],color:string,chart?:DashboardWidget['chart']):DashboardWidget=>({id,source,title,width,height,color,...(chart?{chart}:{})});
const pendingBillsWidget=widget('contas-pendentes','bills','Contas pendentes',1,'compact','#f59e0b');
export const defaultDashboardPreferences:DashboardPreferences={version:1,activeId:'principal',views:[{id:'principal',name:'Painel principal',sections:[
 {id:'resumo',name:'Resumo do mês',columns:4,widgets:[widget('saldo','balance','Saldo disponível',1,'medium','#14b8a6'),widget('entradas','income','Entradas recebidas',1,'compact','#22c55e'),widget('saidas','expenses','Saídas pagas',1,'compact','#ef4444'),widget('previsao','forecast','Previsão de fechamento',1,'medium','#3b82f6'),pendingBillsWidget]},
 {id:'analise',name:'Análise financeira',columns:2,widgets:[widget('categorias','categories','Gastos por categoria',1,'large','#8b5cf6','donut'),widget('fluxo','cashflow','Evolução do saldo',1,'large','#06b6d4','area')]},
 {id:'carteiras',name:'Carteiras',columns:2,widgets:[widget('saldos','wallets','Saldo por carteira',2,'medium','#0ea5e9')]},
 {id:'objetivos',name:'Objetivos',columns:2,widgets:[widget('metas','goals','Metas financeiras',2,'medium','#eab308')]},
]}]};
export const goalChartOptions = [
 {value:'bars',label:'Barras'},
 {value:'donut',label:'Rosca'},
 {value:'pie',label:'Pizza'},
] as const;
export function goalChart(chart: DashboardWidget['chart']) {
 return chart==='donut'||chart==='pie'?chart:'bars';
}
const widths=[1,2,3,4];
export function normalizeDashboardPreferences(value:unknown):DashboardPreferences{
 const raw=value&&typeof value==='object'?value as any:{};
 const views=Array.isArray(raw.views)?raw.views.flatMap((view:any,vi:number)=>{
  if(!view||typeof view!=='object')return[];
  const sections=Array.isArray(view.sections)?view.sections.flatMap((section:any,si:number)=>{
   if(!section||typeof section!=='object')return[];
   const widgets=Array.isArray(section.widgets)?section.widgets.flatMap((item:any,wi:number)=>{
    if(!item||!dashboardSources.some(source=>source.id===item.source))return[];
    return [{id:typeof item.id==='string'?item.id:`widget-${vi}-${si}-${wi}`,source:item.source,title:String(item.title||dashboardSources.find(s=>s.id===item.source)!.name).slice(0,60),width:widths.includes(Number(item.width))?Number(item.width):1,height:item.height==='large'||item.height==='medium'?item.height:'compact',...(typeof item.color==='string'&&/^#[0-9a-f]{6}$/i.test(item.color)?{color:item.color.toLowerCase()}:{}),...(item.source==='balance'&&(item.balanceScope==='cash'||item.balanceScope==='benefits'||item.balanceScope==='credit')?{balanceScope:item.balanceScope}:{}),...(item.source==='wallets'&&item.walletLayout==='compact'?{walletLayout:'compact' as const}:{}),...(item.source==='wallets'&&widths.includes(Number(item.walletColumns))?{walletColumns:Number(item.walletColumns)}:{}),...(['donut','pie','bars','line','area'].includes(item.chart)?{chart:item.chart}:{})}];
   }):[];
   if(raw.version!==1&&section.id==='resumo'&&!widgets.some((item:DashboardWidget)=>item.source==='bills'))widgets.push({...pendingBillsWidget});
   return [{id:String(section.id||`section-${vi}-${si}`),name:String(section.name||`Seção ${si+1}`).slice(0,60),columns:widths.includes(Number(section.columns))?Number(section.columns):2,...([320,480,640].includes(section.height)?{height:section.height}:{}),widgets}];
  }):[];
  return [{id:String(view.id||`view-${vi}`),name:String(view.name||`Painel ${vi+1}`).slice(0,60),sections}];
 }):[];
 if(!views.length)return structuredClone(defaultDashboardPreferences);
 const activeId=views.some(view=>view.id===raw.activeId)?raw.activeId:views[0].id;
 return {views,activeId,version:1};
}
