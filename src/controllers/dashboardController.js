const User = require('../models/User');
const Activity = require('../models/Activity');
const LeaderboardSnapshot = require('../models/LeaderboardSnapshot');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/dashboard/me — auth required. A single user's personal overview:
// stats plus recent activity.
const getMyDashboard = asyncHandler(async (req, res) => {
  const [user, referralCount, recentActivities] = await Promise.all([
    User.findById(req.user.id),
    User.countReferrals(req.user.id),
    Activity.recentForUser(req.user.id, 10),
  ]);

  res.json({
    stats: {
      total_points: user.total_points,
      daily_points: user.daily_points,
      rank: user.rank,
      current_streak: user.current_streak,
      longest_streak: user.longest_streak,
      referral_count: referralCount,
      referral_code: user.referral_code,
    },
    recent_activities: recentActivities,
  });
});

// GET /api/dashboard — aggregate stats for an admin/overview screen.
const getDashboard = asyncHandler(async (req, res) => {
  const [totalUsers, signupsToday, activitiesToday, topMovers] = await Promise.all([
    User.countAll(),
    User.countSignupsToday(),
    Activity.countToday(),
    LeaderboardSnapshot.getTopMovers(5).catch(() => []), // empty until day 2 of data
  ]);

  res.json({
    total_users: totalUsers,
    signups_today: signupsToday,
    activities_today: activitiesToday,
    top_movers: topMovers,
  });
});

module.exports = { getDashboard, getMyDashboard };
