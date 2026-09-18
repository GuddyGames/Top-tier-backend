const db = require('../config/db');

const LeaderboardSnapshot = {
  // Called once a day by the cron job, after ranks are recalculated.
  async takeSnapshot() {
    await db.query(`
      INSERT INTO leaderboard_snapshots (user_id, snapshot_date, total_points, rank)
      SELECT id, CURRENT_DATE, total_points, rank FROM users
      ON CONFLICT (user_id, snapshot_date)
      DO UPDATE SET total_points = EXCLUDED.total_points, rank = EXCLUDED.rank
    `);
  },

  // Compares today's rank to yesterday's to surface who climbed the most.
  async getTopMovers(limit = 5) {
    const { rows } = await db.query(
      `SELECT u.id, u.username, u.rank AS current_rank, y.rank AS previous_rank,
              (y.rank - u.rank) AS positions_gained
       FROM users u
       JOIN leaderboard_snapshots y
         ON y.user_id = u.id AND y.snapshot_date = CURRENT_DATE - INTERVAL '1 day'
       ORDER BY positions_gained DESC
       LIMIT $1`,
      [limit]
    );
    return rows;
  },
};

module.exports = LeaderboardSnapshot;
