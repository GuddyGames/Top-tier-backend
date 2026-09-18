const db = require('../config/db');

// Simple notional P&L: % price move * position size, direction-aware.
// No leverage/margin modeling — good enough for teaching the mechanics.
function calculatePnl({ side, size, entryPrice, exitPrice }) {
  const priceChangePct = (exitPrice - entryPrice) / entryPrice;
  const directionalPct = side === 'buy' ? priceChangePct : -priceChangePct;
  return Math.round(size * directionalPct * 100) / 100;
}

// Called every price tick. Finds open trades whose stop-loss or
// take-profit has been crossed by the current simulated price and
// closes them automatically — same accounting as a manual close, just
// triggered by price instead of a button press.
async function checkStopsAndTargets() {
  const { rows: openTrades } = await db.query(`
    SELECT t.*, p.price AS current_price
    FROM demo_trades t
    JOIN demo_symbol_prices p ON p.symbol = t.symbol
    WHERE t.status = 'open' AND (t.stop_loss IS NOT NULL OR t.take_profit IS NOT NULL)
  `);

  for (const trade of openTrades) {
    const price = parseFloat(trade.current_price);
    const sl = trade.stop_loss !== null ? parseFloat(trade.stop_loss) : null;
    const tp = trade.take_profit !== null ? parseFloat(trade.take_profit) : null;

    let reason = null;
    if (trade.side === 'buy') {
      if (sl !== null && price <= sl) reason = 'stop_loss';
      else if (tp !== null && price >= tp) reason = 'take_profit';
    } else {
      if (sl !== null && price >= sl) reason = 'stop_loss';
      else if (tp !== null && price <= tp) reason = 'take_profit';
    }

    if (!reason) continue;

    const pnl = calculatePnl({
      side: trade.side,
      size: parseFloat(trade.size),
      entryPrice: parseFloat(trade.entry_price),
      exitPrice: price,
    });

    await db.query(
      `UPDATE demo_trades
       SET exit_price = $2, pnl = $3, status = 'closed', closed_at = NOW(), close_reason = $4
       WHERE id = $1`,
      [trade.id, price, pnl, reason]
    );
    await db.query('UPDATE demo_accounts SET balance = balance + $2 WHERE user_id = $1', [
      trade.user_id,
      pnl,
    ]);
  }
}

module.exports = { calculatePnl, checkStopsAndTargets };
