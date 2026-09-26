const User = require('../models/User');
const Activity = require('../models/Activity');
const LeaderboardSnapshot = require('../models/LeaderboardSnapshot');
const Task = require('../models/Task');
const asyncHandler = require('../utils/asyncHandler');

const getMyDashboard = asyncHandler(async (req, res) => {
  const [user, referralRows, recentActivities, tasks] = await Promise.all([
    User.findById(req.user.id),
    User.getReferrals(req.user.id),
    Activity.recentForUser(req.user.id, 10),
    Task.listActive(),
  ]);

  res.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      telegram_username: user.telegram_username,
    },
    stats: {
      total_points: user.total_points,
      daily_points: user.daily_points,
      rank: user.rank,
      current_streak: user.current_streak,
      longest_streak: user.longest_streak,
      referral_count: referralRows.length,
      referral_code: user.referral_code,
    },
    referrals: referralRows,
    tasks,
    recent_activities: recentActivities,
  });
});

const getDashboard = asyncHandler(async (req, res) => {
  const [totalUsers, signupsToday, activitiesToday, topMovers] = await Promise.all([
    User.countAll(),
    User.countSignupsToday(),
    Activity.countToday(),
    LeaderboardSnapshot.getTopMovers(5).catch(() => []),
  ]);
  res.json({ total_users: totalUsers, signups_today: signupsToday, activities_today: activitiesToday, top_movers: topMovers });
});

module.exports = { getDashboard, getMyDashboard };
