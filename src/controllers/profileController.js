const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/profile/me — auth required. Account-level identity info,
// as opposed to /api/dashboard/me which is stats/activity-focused.
const getMyProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    telegram_username: user.telegram_username,
    telegram_verified_at: user.telegram_verified_at,
    referral_code: user.referral_code,
    status: user.status,
    role: user.role,
    created_at: user.created_at,
  });
});

// PATCH /api/profile/me — auth required. Body: { telegramUsername? }
const updateMyProfile = asyncHandler(async (req, res) => {
  const { telegramUsername } = req.body;
  const updated = await User.updateTelegramUsername(req.user.id, telegramUsername);
  res.json({ id: updated.id, telegram_username: updated.telegram_username });
});

module.exports = { getMyProfile, updateMyProfile };
