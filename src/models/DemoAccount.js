const db = require('../config/db');

const DemoAccount = {
  // Every user gets one lazily, the first time they touch demo trading.
  async findOrCreate(userId) {
    const existing = await db.query('SELECT * FROM demo_accounts WHERE user_id = $1', [userId]);
    if (existing.rows[0]) return existing.rows[0];

    const { rows } = await db.query(
      'INSERT INTO demo_accounts (user_id) VALUES ($1) RETURNING *',
      [userId]
    );
    return rows[0];
  },

  async adjustBalance(userId, delta) {
    const { rows } = await db.query(
      'UPDATE demo_accounts SET balance = balance + $2 WHERE user_id = $1 RETURNING *',
      [userId, delta]
    );
    return rows[0];
  },
};

module.exports = DemoAccount;
