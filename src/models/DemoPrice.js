const db = require('../config/db');

const DemoPrice = {
  async all() {
    const { rows } = await db.query('SELECT symbol, price, updated_at FROM demo_symbol_prices ORDER BY symbol');
    return rows;
  },

  async get(symbol) {
    const { rows } = await db.query('SELECT symbol, price, updated_at FROM demo_symbol_prices WHERE symbol = $1', [
      symbol,
    ]);
    return rows[0] || null;
  },
};

module.exports = DemoPrice;
