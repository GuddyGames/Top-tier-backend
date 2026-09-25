const crypto = require('crypto');
const User = require('../models/User');
const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

const CHANNEL_USERNAME = process.env.TELEGRAM_CHANNEL_USERNAME || '@Toptiertradingchannel';
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
  });
});

// POST /api/telegram/webhook
const webhook = asyncHandler(async (req, res) => {
  res.sendStatus(200);

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
    await telegramApi('setWebhook', { url });
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
