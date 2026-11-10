let balanceUSDT = Number(process.env.PAPER_START_BALANCE_USDT || 1000);
const positions = new Map();

function getState() {
  return { balanceUSDT, positions: Object.fromEntries(positions) };
}

function buy(coinId, usdtAmount, price) {
  if (usdtAmount <= 0) return { error: 'Monto invalido' };
  if (usdtAmount > balanceUSDT) return { error: 'Saldo insuficiente' };
  const qty = usdtAmount / price;
  const pos = positions.get(coinId) || { qty: 0, avgPrice: 0 };
  const newQty = pos.qty + qty;
  pos.avgPrice = (pos.qty * pos.avgPrice + qty * price) / newQty;
  pos.qty = newQty;
  positions.set(coinId, pos);
  balanceUSDT -= usdtAmount;
  return { ok: true, coinId, qty, price, balanceUSDT };
}

function sell(coinId, price) {
  const pos = positions.get(coinId);
  if (!pos || pos.qty <= 0) return { error: 'No tienes posicion en ' + coinId };
  const proceeds = pos.qty * price;
  const pnl = proceeds - pos.qty * pos.avgPrice;
  balanceUSDT += proceeds;
  positions.delete(coinId);
  return { ok: true, coinId, proceeds, pnl, balanceUSDT };
}

module.exports = { buy, sell, getState };
