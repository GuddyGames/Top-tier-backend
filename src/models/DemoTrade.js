const db = require('../config/db');

const DemoTrade = {
  async open({ userId, symbol, side, size, entryPrice, stopLoss, takeProfit }) {
    const { rows } = await db.query(
      `INSERT INTO demo_trades (user_id, symbol, side, size, entry_price, stop_loss, take_profit)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, symbol, side, size, entryPrice, stopLoss || null, takeProfit || null]
    );
    return rows[0];
  },

  async findOpenById(id, userId) {
    const { rows } = await db.query(
      `SELECT * FROM demo_trades WHERE id = $1 AND user_id = $2 AND status = 'open'`,
      [id, userId]
    );
    return rows[0] || null;
  },

  async close(id, { exitPrice, pnl, closeReason = 'manual' }) {
    const { rows } = await db.query(
      `UPDATE demo_trades
       SET exit_price = $2, pnl = $3, status = 'closed', closed_at = NOW(), close_reason = $4
       WHERE id = $1
       RETURNING *`,
      [id, exitPrice, pnl, closeReason]
    );
    return rows[0];
  },

  async listForUser(userId) {
    const { rows } = await db.query(
      `SELECT * FROM demo_trades WHERE user_id = $1 ORDER BY opened_at DESC LIMIT 100`,
      [userId]
    );
    return rows;
  },

  // Powers both the admin panel and the beginner's own performance Home page.
  async summaryForUser(userId) {
    const { rows } = await db.query(
      `SELECT
         COUNT(*)::int AS total_trades,
         COUNT(*) FILTER (WHERE status = 'open')::int AS open_trades,
         COUNT(*) FILTER (WHERE status = 'closed')::int AS closed_trades,
         COUNT(*) FILTER (WHERE status = 'closed' AND pnl > 0)::int AS winning_trades,
         COALESCE(SUM(pnl) FILTER (WHERE status = 'closed'), 0)::float AS total_pnl
       FROM demo_trades
       WHERE user_id = $1`,
      [userId]
    );
    const s = rows[0];
    return {
      ...s,
      win_rate: s.closed_trades > 0 ? Math.round((s.winning_trades / s.closed_trades) * 1000) / 10 : null,
    };
  },
};

module.exports = DemoTrade;
