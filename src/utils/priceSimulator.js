// Nudges each non-live demo symbol's price by a small random percentage and records the tick.
const db = require('../config/db');

const VOLATILITY = {
  'EUR/USD': 0.00035,
  'GBP/USD': 0.00035,
  'USD/JPY': 0.0004,
  'AUD/USD': 0.00035,
  'USD/CAD': 0.00035,
  'XAU/USD': 0.0006,
  'XAG/USD': 0.001,
  'BTC/USD': 0.004,
  'ETH/USD': 0.005,
  'SOL/USD': 0.008,
};

const LIVE_SYMBOLS = new Set(['EUR/USD', 'BTC/USD', 'XAU/USD']);

function randomWalk(price, vol) {
  const change = (Math.random() * 2 - 1) * vol;
  return Math.max(price * (1 + change), 0.00001);
}

async function tick() {
  const { rows } = await db.query('SELECT symbol, price FROM demo_symbol_prices');

  for (const row of rows) {
    if (LIVE_SYMBOLS.has(row.symbol)) continue;

    const vol = VOLATILITY[row.symbol] ?? 0.0005;
    const next = randomWalk(parseFloat(row.price), vol);
    await db.query(
      'UPDATE demo_symbol_prices SET price = $2, updated_at = NOW() WHERE symbol = $1',
      [row.symbol, next]
    );
    await db.query('INSERT INTO demo_price_history (symbol, price) VALUES ($1, $2)', [row.symbol, next]);
  }
}

module.exports = { tick };
