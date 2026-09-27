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

const getNotifications = asyncHandler(async (req,res)=>{
  const { rows } = await require('../config/db').query('SELECT id,title,message,read_at,created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50',[req.user.id]);
  res.json({notifications:rows});
});
const markNotificationRead = asyncHandler(async (req,res)=>{
  const { rows } = await require('../config/db').query('UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE id=$1 AND user_id=$2 RETURNING id,read_at',[req.params.id,req.user.id]);
  if(!rows[0]) return res.status(404).json({error:'Notification not found'});
  res.json(rows[0]);
});

module.exports = { getMyProfile, updateMyProfile, updateNotifications, acceptPrivacy, getNotifications, markNotificationRead };
