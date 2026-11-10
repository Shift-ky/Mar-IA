export const currencies=[['BRL','Real brasileiro'],['USD','Dólar americano'],['EUR','Euro'],['GBP','Libra esterlina'],['CAD','Dólar canadense'],['AUD','Dólar australiano'],['CHF','Franco suíço'],['JPY','Iene japonês'],['ARS','Peso argentino']] as const;
export type FxQuote={rate:number;date:string};
export async function fetchExchangeRates():Promise<Record<string,FxQuote>>{
 const response=await fetch('https://api.frankfurter.dev/v2/rates?base=BRL&quotes=USD,EUR,GBP,CAD,AUD,CHF,JPY,ARS',{signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('Cotação indisponível.');
 const rows=await response.json();if(!Array.isArray(rows))throw Error('Cotação inválida.');
 return Object.fromEntries(rows.filter(r=>r.base==='BRL'&&Number.isFinite(r.rate)&&r.rate>0&&currencies.some(([code])=>code===r.quote)).map(r=>[r.quote,{rate:1/r.rate,date:r.date}]));
}
