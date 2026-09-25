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
              telegram_verified_at, telegram_user_id,
              longest_streak, last_active_date, rank, created_at
       FROM users WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async updateContribution(userId, contribution) {
    const { rows } = await db.query(
      `UPDATE users
       SET total_contribution = $2
       WHERE id = $1
       RETURNING id, username, total_contribution`,
      [userId, contribution]
    );
    return rows[0] || null;
  },

  async deleteAccount(userId, { preventLastAdmin = true } = {}) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const userResult = await client.query(
        'SELECT id, role FROM users WHERE id = $1 FOR UPDATE',
        [userId]
      );
      const user = userResult.rows[0];
      if (!user) {
        await client.query('ROLLBACK');
        return { deleted: false, reason: 'not_found' };
      }

      if (preventLastAdmin && user.role === 'admin') {
        const adminResult = await client.query(
          `SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin' AND id <> $1`,
          [userId]
        );
        if (adminResult.rows[0].count === 0) {
          await client.query('ROLLBACK');
          return { deleted: false, reason: 'last_admin' };
        }
      }

      // Most user-owned records use ON DELETE CASCADE. Tasks authored by the
      // user deliberately keep the task and clear created_by via SET NULL.
      await client.query('DELETE FROM users WHERE id = $1', [userId]);
      await client.query('COMMIT');
      return { deleted: true };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
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

  async saveTelegramVerificationToken(userId, tokenHash, expiresAt) {
    await db.query(
      `UPDATE users
       SET telegram_verification_token_hash = $2,
           telegram_verification_expires_at = $3
       WHERE id = $1`,
      [userId, tokenHash, expiresAt]
    );
  },

  async findByTelegramVerificationToken(tokenHash) {
    const { rows } = await db.query(
      `SELECT id AS user_id
       FROM users
       WHERE telegram_verification_token_hash = $1
         AND telegram_verification_expires_at > NOW()`,
      [tokenHash]
    );
    return rows[0] || null;
  },

  async markTelegramVerified(userId, telegramUserId, telegramUsername, verifiedAt) {
    const { rows } = await db.query(
      `UPDATE users
       SET telegram_user_id = $2,
           telegram_username = $3,
           telegram_verified_at = $4,
           telegram_verification_token_hash = NULL,
           telegram_verification_expires_at = NULL
       WHERE id = $1
       RETURNING id, telegram_username, telegram_user_id, telegram_verified_at`,
      [userId, telegramUserId, telegramUsername || null, verifiedAt]
    );
    return rows[0] || null;
  },

  async updateTelegramUsername(userId, telegramUsername) {
    const { rows } = await db.query(
      `UPDATE users SET telegram_username = $2 WHERE id = $1
       RETURNING id, telegram_username`,
      [userId, telegramUsername || null]
    );
    return rows[0];
  },

  // Admin override — unlike updateTelegramUsername (self-service), this can
  // also change the username itself. Only pass fields that were actually
  // provided so a partial edit doesn't null out the rest.
  async adminUpdateProfile(userId, { username, telegramUsername }) {
    const fields = [];
    const values = [userId];
    if (username !== undefined) {
      values.push(username);
      fields.push(`username = $${values.length}`);
    }
    if (telegramUsername !== undefined) {
      values.push(telegramUsername);
      fields.push(`telegram_username = $${values.length}`);
    }
    if (fields.length === 0) return User.findById(userId);

    const { rows } = await db.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $1 RETURNING id, username, telegram_username`,
      values
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
