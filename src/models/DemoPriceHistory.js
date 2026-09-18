const db = require('../config/db');

const DemoPriceHistory = {
  // Aggregates raw ticks into 1-minute OHLC candles — the shape a
  // candlestick chart (e.g. lightweight-charts) expects.
  async getCandles(symbol, hours = 4) {
    const { rows } = await db.query(
      `SELECT
         date_trunc('minute', recorded_at) AS time,
         (array_agg(price ORDER BY recorded_at ASC))[1] AS open,
         MAX(price) AS high,
         MIN(price) AS low,
         (array_agg(price ORDER BY recorded_at DESC))[1] AS close
       FROM demo_price_history
       WHERE symbol = $1 AND recorded_at > NOW() - ($2 || ' hours')::interval
       GROUP BY 1
       ORDER BY 1`,
      [symbol, hours]
    );
    return rows;
  },
};

module.exports = DemoPriceHistory;
