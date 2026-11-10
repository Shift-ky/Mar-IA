export function entryDate(value?:unknown){
 if(typeof value==='string'&&value.trim())return value;
 return new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'});
}

export function dateEntry<T extends Record<string,any>|null|undefined>(data:T){
 if(!data)return data;
 return {...data,date:entryDate(data.date)};
}
