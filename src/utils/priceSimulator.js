// Nudges each demo symbol's price by a small random percentage and
// records the tick to demo_price_history for charting.
// Deliberately simple — this is for practice trades, not real market
// data. Swap `tick()` for a real price-feed call later; nothing else
// in the demo-trading code needs to change since it only ever reads
// the current price from demo_symbol_prices.
const db = require('../config/db');

// Rough per-tick volatility per instrument (as a fraction of price).
// Crypto moves more than majors, so it gets a wider band. Scaled down
// from the old once-a-minute values since this now ticks every 10s.
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

function randomWalk(price, vol) {
  const change = (Math.random() * 2 - 1) * vol; // -vol .. +vol
  const next = price * (1 + change);
  return Math.max(next, 0.00001);
}

async function tick() {
  const { rows } = await db.query('SELECT symbol, price FROM demo_symbol_prices');

  for (const row of rows) {
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
