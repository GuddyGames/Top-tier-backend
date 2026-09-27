const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const PRIVACY_POLICY_VERSION = process.env.PRIVACY_POLICY_VERSION || '1.0';

const getMyProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json({
    id: user.id, username: user.username, email: user.email, telegram_username: user.telegram_username,
    telegram_verified_at: user.telegram_verified_at, referral_code: user.referral_code, status: user.status, role: user.role,
    created_at: user.created_at, notification_enabled: user.notification_enabled !== false,
    privacy_accepted_at: user.privacy_accepted_at, privacy_policy_version: user.privacy_policy_version,
    privacy_policy_version_current: PRIVACY_POLICY_VERSION,
  });
});

const updateMyProfile = asyncHandler(async (req, res) => {
  const { username, email, telegramUsername } = req.body;
  const updated = await User.updateProfile(req.user.id, { username, email, telegramUsername });
  res.json(updated);
});

const updateNotifications = asyncHandler(async (req, res) => {
  const enabled = Boolean(req.body.enabled);
  const updated = await User.setNotificationEnabled(req.user.id, enabled);
  res.json(updated);
});

const acceptPrivacy = asyncHandler(async (req, res) => {
  const updated = await User.acceptPrivacy(req.user.id, PRIVACY_POLICY_VERSION);
  res.json({ accepted: true, ...updated });
});

module.exports = { getMyProfile, updateMyProfile, updateNotifications, acceptPrivacy };
