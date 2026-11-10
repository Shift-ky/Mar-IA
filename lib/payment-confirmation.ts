export function confirmPayment(data:any,prior:any){
 if(prior?.paid&&data.paid===false)return {...data,date:prior.originalDate||prior.date,originalDate:undefined,paidAt:undefined};
 if(!prior||prior.paid||data.paid!==true)return data;
 const candidate=data.paidAt;
 const paidAt=typeof candidate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(candidate)&&!isNaN(Date.parse(candidate))?candidate:new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'});
 return {...data,originalDate:prior.originalDate||prior.date,paidAt,date:paidAt};
}
