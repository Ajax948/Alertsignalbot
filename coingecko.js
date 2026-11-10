const BASE = 'https://api.coingecko.com/api/v3';

async function getPrice(coinId, currency = 'usd') {
  const url = `${BASE}/simple/price?ids=${coinId}&vs_currencies=${currency}&include_24hr_change=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko respondio ${res.status}`);
  const data = await res.json();
  if (!data[coinId]) throw new Error(`Moneda no encontrada: ${coinId}`);
  return {
    price: data[coinId][currency],
    changePct24h: data[coinId][`${currency}_24h_change`],
  };
}

async function searchCoin(query) {
  const res = await fetch(`${BASE}/search?query=${encodeURIComponent(query)}`);
  const data = await res.json();
  const coins = (data.coins || []).slice(0, 5);
  return coins.map((c) => ({ id: c.id, name: c.name, symbol: c.symbol }));
}

async function getMarketChart(coinId, days = 7, currency = 'usd') {
  const url = `${BASE}/coins/${coinId}/market_chart?vs_currency=${currency}&days=${days}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko respondio ${res.status}`);
  const data = await res.json();
  return data.prices.map(([ts, price]) => ({
    t: new Date(ts).toISOString().slice(0, 10),
    p: price,
  }));
}

module.exports = { getPrice, searchCoin, getMarketChart };
