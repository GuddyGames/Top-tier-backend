const db = require('../config/db');

const Activity = {
  async log({ userId, actionType, points, note }) {
    const { rows } = await db.query(
      `INSERT INTO activities (user_id, action_type, points, note)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, action_type, points, note, created_at`,
      [userId, actionType, points, note || null]
    );
    return rows[0];
  },

  async recentForUser(userId, limit = 20) {
    const { rows } = await db.query(
      `SELECT id, action_type, points, note, created_at
       FROM activities
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return rows;
  },

  // Admin oversight — every user's activity, newest first.
  async recentGlobal(limit = 50) {
    const { rows } = await db.query(
      `SELECT a.id, a.action_type, a.points, a.note, a.created_at, u.id AS user_id, u.username
       FROM activities a
       JOIN users u ON u.id = a.user_id
       ORDER BY a.created_at DESC
       LIMIT $1`,
      [limit]
    );
    return rows;
  },

  async countToday() {
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS count FROM activities WHERE created_at::date = CURRENT_DATE`
    );
    return rows[0].count;
  },
};

module.exports = Activity;
