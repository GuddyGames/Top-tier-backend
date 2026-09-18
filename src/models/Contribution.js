const db = require('../config/db');

const Contribution = {
  async create({ userId, amount, note, recordedBy }) {
    const { rows } = await db.query(
      `INSERT INTO contributions (user_id, amount, note, recorded_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, amount, note || null, recordedBy]
    );
    return rows[0];
  },

  async listForUser(userId) {
    const { rows } = await db.query(
      `SELECT id, amount, note, created_at
       FROM contributions
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    return rows;
  },

  async listAll() {
    const { rows } = await db.query(
      `SELECT c.id, c.amount, c.note, c.created_at, u.id AS user_id, u.username
       FROM contributions c
       JOIN users u ON u.id = c.user_id
       ORDER BY c.created_at DESC`
    );
    return rows;
  },

  async totalPool() {
    const { rows } = await db.query('SELECT COALESCE(SUM(amount), 0) AS total FROM contributions');
    return Number(rows[0].total);
  },
};

module.exports = Contribution;
