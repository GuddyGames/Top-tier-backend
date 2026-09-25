const User = require('../models/User');
const Activity = require('../models/Activity');
const POINTS = require('../config/points');
const { computeStreak } = require('../utils/streak');
const asyncHandler = require('../utils/asyncHandler');

// POST /api/activity  { actionType: "post_created" }
// Auth required — req.user.id comes from the JWT.
const logActivity = asyncHandler(async (req, res) => {
  const { actionType } = req.body;
  const points = POINTS[actionType];

  if (actionType === 'login') {
    const user = await User.findById(req.user.id);
    const today = new Date().toISOString().slice(0, 10);
    if (user.last_active_date && new Date(user.last_active_date).toISOString().slice(0, 10) === today) {
      return res.status(409).json({ error: 'Daily login already claimed today' });
    }
  }

  if (points === undefined) {
    return res.status(400).json({
      error: `Unknown actionType "${actionType}"`,
      validTypes: Object.keys(POINTS),
    });
  }

  const activity = await Activity.log({ userId: req.user.id, actionType, points });
  const updated = await User.addPoints(req.user.id, points);

  let streakInfo = null;

  // Streak tracking is keyed off "login" activity — one per day counts.
  if (actionType === 'login') {
    const user = await User.findById(req.user.id);
    const result = computeStreak({
      lastActiveDate: user.last_active_date,
      currentStreak: user.current_streak,
      longestStreak: user.longest_streak,
    });

    await User.updateStreak(req.user.id, result);

    if (result.bonusEarned) {
      await Activity.log({ userId: req.user.id, actionType: 'streak_bonus', points: POINTS.streak_bonus });
      await User.addPoints(req.user.id, POINTS.streak_bonus);
    }

    streakInfo = { currentStreak: result.currentStreak, bonusEarned: result.bonusEarned };
  }

  res.status(201).json({
    activity,
    total_points: updated.total_points,
    daily_points: updated.daily_points,
    streak: streakInfo,
  });
});

// GET /api/activity/me
const myActivity = asyncHandler(async (req, res) => {
  const activities = await Activity.recentForUser(req.user.id, 20);
  res.json({ activities });
});

module.exports = { logActivity, myActivity };
