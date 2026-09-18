const db = require('../config/db');

const User = {
  async create({ username, email, passwordHash, referralCode, referredBy, telegramUsername }) {
    const { rows } = await db.query(
      `INSERT INTO users (username, email, password_hash, referral_code, referred_by, telegram_username)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, email, referral_code, referred_by, telegram_username,
                 total_points, daily_points, current_streak, created_at`,
      [username, email, passwordHash, referralCode, referredBy || null, telegramUsername || null]
    );
    return rows[0];
  },

  async findByReferralCode(code) {
    const { rows } = await db.query('SELECT * FROM users WHERE referral_code = $1', [code]);
    return rows[0] || null;
  },

  async countReferrals(userId) {
    const { rows } = await db.query(
      'SELECT COUNT(*)::int AS count FROM users WHERE referred_by = $1',
      [userId]
    );
    return rows[0].count;
  },

  async findByEmail(email) {
    const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    return rows[0] || null;
  },

  async findByUsername(username) {
    const { rows } = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    return rows[0] || null;
  },

  async findById(id) {
    const { rows } = await db.query(
      `SELECT id, username, email, role, referral_code, telegram_username, status,
              total_contribution, total_points, daily_points, current_streak,
              longest_streak, last_active_date, rank, created_at
       FROM users WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  // Adds points to both the lifetime and today's tally in one statement.
  async addPoints(userId, points) {
    const { rows } = await db.query(
      `UPDATE users
       SET total_points = total_points + $2,
           daily_points  = daily_points + $2
       WHERE id = $1
       RETURNING id, total_points, daily_points`,
      [userId, points]
    );
    return rows[0];
  },

  async updateStreak(userId, { currentStreak, longestStreak, lastActiveDate }) {
    const { rows } = await db.query(
      `UPDATE users
       SET current_streak = $2,
           longest_streak = $3,
           last_active_date = $4
       WHERE id = $1
       RETURNING id, current_streak, longest_streak, last_active_date`,
      [userId, currentStreak, longestStreak, lastActiveDate]
    );
    return rows[0];
  },

  async updateTelegramUsername(userId, telegramUsername) {
    const { rows } = await db.query(
      `UPDATE users SET telegram_username = $2 WHERE id = $1
       RETURNING id, telegram_username`,
      [userId, telegramUsername || null]
    );
    return rows[0];
  },

  async getLeaderboard({ limit = 20, offset = 0 } = {}) {
    const { rows } = await db.query(
      `SELECT u.id, u.username, u.telegram_username, u.status, u.created_at,
              u.total_contribution, u.total_points, u.daily_points,
              u.current_streak, u.rank,
              (SELECT COUNT(*)::int FROM users r WHERE r.referred_by = u.id) AS referral_count
       FROM users u
       ORDER BY u.total_points DESC, u.id ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return rows;
  },

  async countAll() {
    const { rows } = await db.query('SELECT COUNT(*)::int AS count FROM users');
    return rows[0].count;
  },

  async countSignupsToday() {
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS count FROM users WHERE created_at::date = CURRENT_DATE`
    );
    return rows[0].count;
  },

  // Recomputes and persists rank for every user, ordered by total_points.
  // Called by the daily cron job (see jobs/dailyRankJob.js).
  async recalculateRanks() {
    await db.query(`
      WITH ranked AS (
        SELECT id, RANK() OVER (ORDER BY total_points DESC) AS new_rank
        FROM users
      )
      UPDATE users
      SET rank = ranked.new_rank
      FROM ranked
      WHERE users.id = ranked.id
    `);
  },

  async resetDailyPoints() {
    await db.query('UPDATE users SET daily_points = 0');
  },
};

module.exports = User;
