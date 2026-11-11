export function inventoryDeletionPlan(records: any[], target: {id: string; kind: string}) {
  const {id, kind} = target;
  const remove = [id];
  const updates = new Map<string, Record<string, unknown>>();
  if (kind === 'productGroup') {
    for (const row of records) {
      if (row.kind === 'product' && row.groupId === id) updates.set(row.id, {groupId: ''});
    }
    return {remove, updates};
  }

  const transactions = records.filter(row => row.kind === 'transaction');
  const receiptIds = new Set(transactions.map(row => row.receiptId).filter(Boolean));
  const purchaseIds = new Set(transactions.map(row => row.purchaseId).filter(Boolean));
  const isLinkedToTransaction = (row: any) =>
    receiptIds.has(row.receiptId) || purchaseIds.has(row.purchaseId);
  const hasProduct = (row: any) =>
    Array.isArray(row.items) && row.items.some((item: any) => item.productId === id);

  if (transactions.some(row => row.productId === id || hasProduct(row)) ||
      records.some(row =>
        ((row.kind === 'purchaseItem' || row.kind === 'stockMovement') &&
          row.productId === id && isLinkedToTransaction(row)) ||
        (row.kind === 'feiraPurchase' && purchaseIds.has(row.id) && hasProduct(row)))) {
    throw Error('Este produto está vinculado a uma transação salva e não pode ser excluído.');
  }

  for (const row of records) {
    if (row.productId === id) {
      if (row.kind === 'stockMovement' || row.kind === 'shoppingItem' && row.autoStock) {
        remove.push(row.id);
      } else if (row.kind === 'shoppingItem' || row.kind === 'purchaseItem') {
        updates.set(row.id, {productId: ''});
      }
    }
    if (row.kind === 'feiraPurchase' && hasProduct(row)) {
      updates.set(row.id, {
        items: row.items.map((item: any) => item.productId === id ? {...item, productId: ''} : item),
      });
    }
  }
  return {remove, updates};
}
