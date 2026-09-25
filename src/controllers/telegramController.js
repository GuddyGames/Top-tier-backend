const crypto = require('crypto');
const User = require('../models/User');
const db = require('../config/db');
const Task = require('../models/Task');
const TaskSubmission = require('../models/TaskSubmission');
const Activity = require('../models/Activity');
const asyncHandler = require('../utils/asyncHandler');

const CHANNEL_USERNAME = process.env.TELEGRAM_CHANNEL_USERNAME || '@Toptiertradingchannel';
const CHANNEL_URL = `https://t.me/${CHANNEL_USERNAME.replace(/^@/, '')}`;

function webhookSecret() {
  return crypto.createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN || '').digest('hex');
}
const TOKEN_TTL_MINUTES = 10;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function telegramApi(method, body) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('Telegram bot is not configured');
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    const error = new Error(data.description || 'Telegram API request failed');
    error.status = response.status;
    throw error;
  }
  return data.result;
}

function normalizeTelegramUsername(username) {
  if (!username) return null;
  return username.replace(/^@/, '').trim().toLowerCase() || null;
}

// POST /api/telegram/verification/start
const startVerification = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.telegram_verified_at) {
    return res.json({ verified: true, telegram_username: user.telegram_username });
  }

  const token = crypto.randomBytes(24).toString('base64url');
  await User.saveTelegramVerificationToken(
    user.id,
    hashToken(token),
    new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000)
  );

  const bot = await telegramApi('getMe', {});
  const deepLink = `https://t.me/${bot.username}?start=${encodeURIComponent(token)}`;

  res.json({
    verified: false,
    expires_in_seconds: TOKEN_TTL_MINUTES * 60,
    telegram_url: deepLink,
    channel_username: CHANNEL_USERNAME,
    channel_url: CHANNEL_URL,
  });
});

// GET /api/telegram/verification/status
const getVerificationStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({
    verified: Boolean(user.telegram_verified_at),
    telegram_username: user.telegram_username,
    telegram_verified_at: user.telegram_verified_at,
    channel_username: CHANNEL_USERNAME,
    channel_url: CHANNEL_URL,
  });
});

async function awardTelegramTasks(userId, telegramUserId) {
  const tasks = await Task.listActiveTelegram();
  const POINTS = require('../config/points');
  for (const task of tasks) {
    const existing = await TaskSubmission.findExisting(task.id, userId);
    if (existing) continue;
    const member = await telegramApi('getChatMember', { chat_id: CHANNEL_USERNAME, user_id: telegramUserId }).catch(() => null);
    const allowedStatuses = new Set(['creator', 'administrator', 'member']);
    if (!member || !allowedStatuses.has(member.status)) continue;
    await TaskSubmission.create({ taskId: task.id, userId, proofUrl: null });
    await db.query(`UPDATE task_submissions SET status = 'approved', reviewed_at = NOW() WHERE task_id = $1 AND user_id = $2`, [task.id, userId]);
    await Activity.log({ userId, actionType: 'task_completed', points: task.points, note: 'Automatic Telegram task verification' });
    await User.addPoints(userId, task.points);
  }
}

// POST /api/telegram/webhook
const webhook = asyncHandler(async (req, res) => {
  res.sendStatus(200);

  const expectedSecret = webhookSecret();
  if (expectedSecret && req.get('X-Telegram-Bot-Api-Secret-Token') !== expectedSecret) {
    return res.sendStatus(401);
  }

  const message = req.body?.message;
  const text = message?.text || '';
  const match = text.match(/^\/start(?:\s+(.+))?$/);
  if (!message?.from || !match?.[1]) return;

  const verification = await User.findByTelegramVerificationToken(hashToken(match[1].trim()));
  if (!verification) {
    await telegramApi('sendMessage', {
      chat_id: message.chat.id,
      text: 'That verification link is invalid or has expired. Start a new verification from Top-Tier.',
    }).catch(() => {});
    return;
  }

  const telegramUserId = message.from.id;
  const telegramUsername = normalizeTelegramUsername(message.from.username);

  const member = await telegramApi('getChatMember', {
    chat_id: CHANNEL_USERNAME,
    user_id: telegramUserId,
  }).catch(() => null);

  const allowedStatuses = new Set(['creator', 'administrator', 'member']);
  const isMember = Boolean(member && allowedStatuses.has(member.status));

  if (!isMember) {
    await telegramApi('sendMessage', {
      chat_id: message.chat.id,
      text: `Please join ${CHANNEL_USERNAME} first, then open the verification link again.`,
    }).catch(() => {});
    return;
  }

  await User.markTelegramVerified(
    verification.user_id,
    telegramUserId,
    telegramUsername,
    new Date()
  );

  await awardTelegramTasks(verification.user_id, telegramUserId);

  const verifiedUser = await User.findById(verification.user_id);
  if (!verifiedUser.telegram_verified_at) return;
  const alreadyAwarded = await db.query(`SELECT 1 FROM activities WHERE user_id = $1 AND action_type = 'telegram_verification_bonus' LIMIT 1`, [verification.user_id]);
  if (alreadyAwarded.rowCount === 0) {
    const POINTS = require('../config/points');
    await db.query(`INSERT INTO activities (user_id, action_type, points, note) VALUES ($1, 'telegram_verification_bonus', $2, 'Telegram channel verification')`, [verification.user_id, POINTS.telegram_verification_bonus]);
    await User.addPoints(verification.user_id, POINTS.telegram_verification_bonus);
  }

  await telegramApi('sendMessage', {
    chat_id: message.chat.id,
    text: 'Telegram verified successfully. You can return to Top-Tier.',
  }).catch(() => {});
});

async function configureTelegramWebhook() {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;
  const baseUrl = process.env.TELEGRAM_WEBHOOK_URL ||
    process.env.PUBLIC_BASE_URL ||
    'https://top-tier-backend-sbd5.onrender.com';
  const url = `${baseUrl.replace(/\/+$/, '')}/api/telegram/webhook`;
  try {
    await telegramApi('setWebhook', { url, secret_token: webhookSecret() });
    console.log('[telegram] webhook configured');
  } catch (error) {
    console.error('[telegram] webhook setup failed:', error.message);
  }
}

module.exports = {
  startVerification,
  getVerificationStatus,
  webhook,
  configureTelegramWebhook,
};
