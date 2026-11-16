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

export function creditInvoiceDate(purchaseDate: string, dueDay: number, installment = 0) {
 const [year, month, day] = purchaseDate.split('-').map(Number);
 const dateForMonth = (offset: number) => {
  const lastDay = new Date(Date.UTC(year, month + offset, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1 + offset, Math.min(dueDay, lastDay)));
 };
 const firstMonth = day > dateForMonth(0).getUTCDate() ? 1 : 0;
 return dateForMonth(firstMonth + installment).toISOString().slice(0, 10);
}

export function creditInvoices(rows: any[], walletOf: (row: any) => string) {
 const invoices = new Map<string, {wallet: string; month: string; cents: number; rows: any[]}>();
 for (const row of rows) {
  const wallet = walletOf(row);
  const month = row.date.slice(0, 7);
  const key = JSON.stringify([wallet, month]);
  const invoice = invoices.get(key) ?? {wallet, month, cents: 0, rows: []};
  invoice.rows.push(row);
  invoice.cents += Math.round(Number(row.amount) * 100);
  invoices.set(key, invoice);
 }
 return [...invoices.values()].sort((a, b) => a.month.localeCompare(b.month) || a.wallet.localeCompare(b.wallet));
}
