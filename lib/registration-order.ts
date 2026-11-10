// SQLite row order preserves insertion order across edits. Pending local inserts
// are appended to the snapshot and follow the confirmed registrations.
export function byRegistrationNewest(items:any[]){
 const max=items.reduce((value,r)=>Math.max(value,Number(r.registrationOrder)||0),0);
 return items.map((record,index)=>({record,index,order:Number(record.registrationOrder)||max+index+1}))
  .sort((a,b)=>b.order-a.order||b.index-a.index).map(item=>item.record);
}
