require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { getPrice, searchCoin, getMarketChart } = require('./coingecko');
const paper = require('./paperBroker');
const alerts = require('./alerts');

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

function chartUrl(labels, prices, coinId, days) {
  const step = Math.max(1, Math.floor(labels.length / 12));
  const sampled = labels.map((l, i) => (i % step === 0 ? l : ''));
  return 'https://quickchart.io/chart?c=' + encodeURIComponent(JSON.stringify({
    type: 'line',
    data: {
      labels: sampled,
      datasets: [{
        label: coinId,
        data: prices,
        borderColor: '#00c853',
        backgroundColor: 'rgba(0,200,83,0.15)',
        fill: true,
        pointRadius: 0,
        borderWidth: 2,
      }],
    },
    options: {
      title: { display: true, text: `${coinId} - ultimos ${days} dias` },
      scales: { yAxes: [{ ticks: { callback: '(v) => "$" + v' } }] },
    },
  }));
}

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `🤖 *Bot de Trading (paper trading con CoinGecko)*\n\n` +
    `/search bitcoin — buscar moneda\n` +
    `/price bitcoin — precio actual\n` +
    `/chart bitcoin 7 — grafico (1/7/30/90 dias)\n` +
    `/alert bitcoin up 5 — alerta si sube 5%\n` +
    `/alert bitcoin any 3 — alerta si sube o baja 3%\n` +
    `/alerts — ver mis alertas\n` +
    `/delalert bitcoin — borrar alerta\n` +
    `/buy bitcoin 100 — comprar con 100 USD\n` +
    `/sell bitcoin — vender posicion\n` +
    `/portfolio — saldo y posiciones`,
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/search (.+)/, async (msg, match) => {
  try {
    const coins = await searchCoin(match[1].trim());
    if (!coins.length) return bot.sendMessage(msg.chat.id, '❌ Sin resultados');
    const text = coins.map((c) => `• \`${c.id}\` (${c.symbol.toUpperCase()}) — ${c.name}`).join('\n');
    bot.sendMessage(msg.chat.id, `🔎 Resultados:\n${text}`, { parse_mode: 'Markdown' });
  } catch (e) {
    bot.sendMessage(msg.chat.id, `❌ Error: ${e.message}`);
  }
});

bot.onText(/\/price (.+)/, async (msg, match) => {
  const coinId = match[1].trim().toLowerCase();
  try {
    const { price, changePct24h } = await getPrice(coinId);
    bot.sendMessage(
      msg.chat.id,
      `📊 *${coinId}*\nPrecio: $${price}\n24h: ${changePct24h?.toFixed(2)}%`,
      { parse_mode: 'Markdown' }
    );
  } catch (e) {
    bot.sendMessage(msg.chat.id, `❌ Error: ${e.message}`);
  }
});

bot.onText(/\/chart (.+?)(?: (\d+))?/, async (msg, match) => {
  const coinId = match[1].trim().toLowerCase();
  const days = Math.min(parseInt(match[2] || '7', 10), 90);
  try {
    const history = await getMarketChart(coinId, days);
    const labels = history.map((h) => h.t);
    const prices = history.map((h) => h.p);
    await bot.sendPhoto(msg.chat.id, chartUrl(labels, prices, coinId, days), {
      caption: `📈 ${coinId} — ultimos ${days} dias`,
    });
  } catch (e) {
    bot.sendMessage(msg.chat.id, `❌ Error: ${e.message}`);
  }
});

bot.onText(/\/alert (\S+) (up|down|any) ([\d.]+)/, (msg, match) => {
  const [, coinId, direction, pct] = match;
  alerts.addAlert({
    chatId: msg.chat.id,
    coinId: coinId.toLowerCase(),
    direction,
    changePct: parseFloat(pct),
  });
  const arrows = { up: '⬆️', down: '⬇️', any: '↕️' };
  bot.sendMessage(
    msg.chat.id,
    `🔔 Alerta creada: ${coinId.toLowerCase()} ${arrows[direction]} ${pct}%`
  );
});

bot.onText(/\/alerts/, (msg) => {
  const my = alerts.listAlerts(msg.chat.id);
  if (!my.length) return bot.sendMessage(msg.chat.id, 'No tienes alertas activas');
  const arrows = { up: '⬆️', down: '⬇️', any: '↕️' };
  const text = my.map((a) => `• ${a.coinId} ${arrows[a.direction]} ${a.changePct}%`).join('\n');
  bot.sendMessage(msg.chat.id, `🔔 Tus alertas:\n${text}`);
});

bot.onText(/\/delalert (.+)/, (msg, match) => {
  const ok = alerts.removeAlert(msg.chat.id, match[1].trim().toLowerCase());
  bot.sendMessage(msg.chat.id, ok ? '✅ Alerta eliminada' : '❌ No se encontro esa alerta');
});

bot.onText(/\/buy (.+) ([\d.]+)/, async (msg, match) => {
  const coinId = match[1].trim().toLowerCase();
  const amount = parseFloat(match[2]);
  try {
    const { price } = await getPrice(coinId);
    const result = paper.buy(coinId, amount, price);
    if (result.error) return bot.sendMessage(msg.chat.id, `❌ ${result.error}`);
    bot.sendMessage(
      msg.chat.id,
      `✅ *COMPRA*\n${result.qty.toFixed(6)} ${coinId} a $${result.price}\nSaldo: $${result.balanceUSDT.toFixed(2)}`,
      { parse_mode: 'Markdown' }
    );
  } catch (e) {
    bot.sendMessage(msg.chat.id, `❌ Error: ${e.message}`);
  }
});

bot.onText(/\/sell (.+)/, async (msg, match) => {
  const coinId = match[1].trim().toLowerCase();
  try {
    const { price } = await getPrice(coinId);
    const result = paper.sell(coinId, price);
    if (result.error) return bot.sendMessage(msg.chat.id, `❌ ${result.error}`);
    bot.sendMessage(
      msg.chat.id,
      `✅ *VENTA*\nRecibiste $${result.proceeds.toFixed(2)}\nPnL: $${result.pnl.toFixed(2)}\nSaldo: $${result.balanceUSDT.toFixed(2)}`,
      { parse_mode: 'Markdown' }
    );
  } catch (e) {
    bot.sendMessage(msg.chat.id, `❌ Error: ${e.message}`);
  }
});

bot.onText(/\/portfolio/, async (msg) => {
  const state = paper.getState();
  let text = `💼 *Portfolio*\nSaldo: $${state.balanceUSDT.toFixed(2)}\n\n`;
  const entries = Object.entries(state.positions);
  if (!entries.length) {
    text += 'Sin posiciones abiertas';
  } else {
    for (const [coinId, p] of entries) {
      try {
        const { price } = await getPrice(coinId);
        const value = p.qty * price;
        const pnl = value - p.qty * p.avgPrice;
        text += `• ${coinId}: ${p.qty.toFixed(6)} @ $${p.avgPrice.toFixed(2)}\n  Valor: $${value.toFixed(2)} | PnL: $${pnl.toFixed(2)}\n`;
      } catch {
        text += `• ${coinId}: ${p.qty.toFixed(6)} @ $${p.avgPrice.toFixed(2)}\n`;
      }
    }
  }
  bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
});

alerts.startAlertEngine(bot, 60000);

console.log('🤖 Bot iniciado');
