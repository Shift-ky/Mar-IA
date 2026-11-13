export function creditInstallment(row:any) {
 if(row.kind!=='transaction'||row.credit!==true)return null;
 if(row.creditPlan)return row.creditPlan;
 // Recover the plan for purchases made before plan metadata was stored.
 const match=/^(.+)-(\d+)$/.exec(row.id);
 const count=Number(row.installments),index=Number(match?.[2]);
 if(!match||!Number.isInteger(count)||count<2||count>48||index>=count)return null;
 return {id:match[1],count,index,name:String(row.name).replace(/ \(\d+\/\d+\)$/,'')};
}

export function creditInstallmentPlans(records:any[]) {
 const plans=new Map<string,{id:string;name:string;count:number;installments:any[]}>();
 for(const row of records){
  const installment=creditInstallment(row);
  if(!installment||row.voided)continue;
  const plan=plans.get(installment.id)||{...installment,installments:[]};
  plan.installments.push({...row,installmentIndex:installment.index});
  plans.set(plan.id,plan);
 }
 return [...plans.values()].map(plan=>({
  ...plan,installments:plan.installments.sort((a,b)=>a.installmentIndex-b.installmentIndex),
 }));
}
