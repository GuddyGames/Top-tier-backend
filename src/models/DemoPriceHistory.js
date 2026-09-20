const db = require('../config/db');

const DemoPriceHistory = {
  // Aggregates raw ticks into OHLC candles bucketed by intervalMinutes —
  // the shape a candlestick chart (e.g. lightweight-charts) expects.
  async getCandles(symbol, { hours = 4, intervalMinutes = 1 } = {}) {
    const bucketSeconds = intervalMinutes * 60;
    const { rows } = await db.query(
      `SELECT
         to_timestamp(floor(extract(epoch FROM recorded_at) / $3) * $3) AS time,
         (array_agg(price ORDER BY recorded_at ASC))[1] AS open,
         MAX(price) AS high,
         MIN(price) AS low,
         (array_agg(price ORDER BY recorded_at DESC))[1] AS close
       FROM demo_price_history
       WHERE symbol = $1 AND recorded_at > NOW() - ($2 || ' hours')::interval
       GROUP BY 1
       ORDER BY 1`,
      [symbol, hours, bucketSeconds]
    );
    return rows;
  },
};

module.exports = DemoPriceHistory;
