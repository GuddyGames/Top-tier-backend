const cron = require('node-cron');
const User = require('../models/User');
const LeaderboardSnapshot = require('../models/LeaderboardSnapshot');
const db = require('../config/db');

// Runs every day at 00:05 server time — five minutes past midnight so
// it lands cleanly after the day's last activity is logged.
// 1. Recalculate every user's rank from total_points
// 2. Snapshot today's standings (used for "top movers" on the dashboard)
// 3. Reset daily_points so today's counter starts fresh
// 4. Prune price history older than 14 days — at a tick every 10s across
//    10 instruments that's ~860k rows/day, and nothing reads history past
//    the 14-day cap the candles endpoint already enforces.
async function runDailyJob() {
  console.log(`[dailyRankJob] running at ${new Date().toISOString()}`);
  try {
    await User.recalculateRanks();
    await LeaderboardSnapshot.takeSnapshot();
    await User.resetDailyPoints();
    const { rowCount } = await db.query(
      `DELETE FROM demo_price_history WHERE recorded_at < NOW() - INTERVAL '14 days'`
    );
    console.log(`[dailyRankJob] completed successfully (pruned ${rowCount} old price rows)`);
  } catch (err) {
    console.error('[dailyRankJob] failed:', err);
  }
}

function scheduleDailyRankJob() {
  cron.schedule('5 0 * * *', runDailyJob);
  console.log('[dailyRankJob] scheduled for 00:05 daily');
}

module.exports = { scheduleDailyRankJob, runDailyJob };
