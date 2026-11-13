import {normalize} from './inventory';
import {validateWalletDefinition, walletBalances, walletNames, wallets} from './wallets';

const nameFields = ['paymentMethod', 'wallet', 'fromWallet', 'toWallet', 'sourcePocketWalletName'];

export function walletEditPlan(records: any[], id: string, raw: any, quotes: Record<string, number> = {}) {
  const wallet = records.find(row => row.id === id && row.kind === 'wallet');
  if (!wallet) throw Error('Carteira não encontrada.');
  const data = {...validateWalletDefinition(raw), balanceRates: {...wallet.balanceRates}};
  if ((data.type==='credito') !== (wallet.type==='credito')) {
    throw Error('Crie uma nova carteira para mudar entre crédito e outros tipos.');
  }
  if (data.type==='credito') {
    const used=Math.round((wallet.creditLimit-walletBalances(records)[wallet.name])*100);
    if (Math.round(Number(data.creditLimit)*100)<used) throw Error('O limite deve cobrir as despesas pendentes.');
  }
  const oldCurrency = wallet.currency || 'BRL';
  if (wallets.some(name => name === wallet.name) && (data.name !== wallet.name || data.currency !== oldCurrency)) {
    throw Error('O nome e a moeda das carteiras padrão são usados pelas regras do aplicativo.');
  }
  if (walletNames(records).some(name => name !== wallet.name && normalize(name) === normalize(data.name))) {
    throw Error('Já existe uma carteira com esse nome.');
  }
  const rename = data.name !== wallet.name;
  if (rename && normalize(data.name) === 'pix') {
    throw Error('Pix é uma forma de pagamento vinculada à carteira Dinheiro.');
  }
  const changeCurrency = data.currency !== oldCurrency;
  if (changeCurrency) {
    for (const currency of new Set([oldCurrency, data.currency])) {
      if (currency === 'BRL') continue;
      const rate = quotes?.[currency];
      if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
        throw Error('Conecte-se para obter a cotação antes de alterar a moeda.');
      }
      data.balanceRates[currency] = rate;
    }
  }

  const updates = new Map<string, Record<string, unknown>>([[id, data]]);
  for (const row of records) {
    if (row.id === id || row.kind === 'walletDeleted') continue;
    const patch: Record<string, unknown> = {};
    if (rename) {
      for (const field of nameFields) {
        if (row[field] === wallet.name) patch[field] = data.name;
      }
      if (row.kind === 'feiraPurchase' && row.payment === wallet.name) patch.payment = data.name;
      if (row.kind === 'goal') {
        if (row.walletId === wallet.name) patch.walletId = data.name;
        if (Array.isArray(row.wallets) && row.wallets.includes(wallet.name)) {
          patch.wallets = [...new Set(row.wallets.map((name: string) => name === wallet.name ? data.name : name))];
        }
      }
    }
    if (changeCurrency && row.kind === 'walletMovement' && row.wallet === wallet.name && !row.currency) {
      patch.currency = oldCurrency;
    }
    if (Object.keys(patch).length) updates.set(row.id, patch);
  }
  return updates;
}
