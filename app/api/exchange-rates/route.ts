import {fetchExchangeRates} from '../../../lib/exchange-rates';
export async function GET(){try{return Response.json({rates:await fetchExchangeRates(),source:'Frankfurter'},{headers:{'Cache-Control':'public, max-age=3600'}})}catch{return Response.json({error:'Não foi possível atualizar as cotações.'},{status:503})}}
