const { getPrice } = require('./coingecko');

const alerts = [];
let intervalId = null;

function addAlert(alert) {
  alert.basePrice = null;
  alert.createdAt = Date.now();
  alerts.push(alert);
  return alert;
}

function removeAlert(chatId, coinId) {
  const idx = alerts.findIndex((a) => a.chatId === chatId && a.coinId === coinId);
  if (idx >= 0) alerts.splice(idx, 1);
  return idx >= 0;
}

function listAlerts(chatId) {
  return alerts.filter((a) => a.chatId === chatId);
}

function startAlertEngine(bot, intervalMs = 60000) {
  if (intervalId) return;
  intervalId = setInterval(async () => {
    for (const alert of alerts) {
      try {
        const { price } = await getPrice(alert.coinId);
        if (!alert.basePrice) {
          alert.basePrice = price;
          continue;
        }
        const change = ((price - alert.basePrice) / alert.basePrice) * 100;
        const triggered =
          (alert.direction === 'up' && change >= alert.changePct) ||
          (alert.direction === 'down' && change <= -alert.changePct) ||
          (alert.direction === 'any' && Math.abs(change) >= alert.changePct);

        if (triggered) {
          const emoji = change >= 0 ? '🚀' : '🔻';
          bot.sendMessage(
            alert.chatId,
            `${emoji} *ALERTA* ${alert.coinId}\n` +
            `Precio: $${price}\n` +
            `Cambio: ${change.toFixed(2)}% (desde $${alert.basePrice.toFixed(4)})`,
            { parse_mode: 'Markdown' }
          );
          removeAlert(alert.chatId, alert.coinId);
        }
      } catch (e) {
        console.error(`Error verificando alerta ${alert.coinId}:`, e.message);
      }
    }
  }, intervalMs);
  console.log(`Motor de alertas activo (cada ${intervalMs / 1000}s)`);
}

module.exports = { addAlert, removeAlert, listAlerts, startAlertEngine };
