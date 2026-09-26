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

function buildTaskToken(taskId, token) { return 'task:' + taskId + ':' + token; }
function parseTaskToken(value) {
  const match = String(value || '').match(/^task:(\d+):(.+)$/);
  return match ? { taskId: Number(match[1]), token: match[2] } : { taskId: null, token: value };
}

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

// POST /api/telegram/tasks/:id/start
const startTelegramTask = asyncHandler(async (req, res) => {
  const taskId = Number(req.params.id);
  if (!Number.isInteger(taskId) || taskId <= 0) return res.status(400).json({ error: 'Invalid task id' });

  const task = await Task.findById(taskId);
  const today = new Date().toISOString().slice(0, 10);
  if (!task || !task.is_active || task.task_type !== 'telegram' || String(task.task_date).slice(0, 10) !== today) {
    return res.status(404).json({ error: 'Telegram task not found or inactive' });
  }

  const existing = await TaskSubmission.findExisting(taskId, req.user.id);
  if (existing) return res.json({ completed: existing.status === 'approved', submission: existing });

  const token = crypto.randomBytes(24).toString('base64url');
  await User.saveTelegramVerificationToken(req.user.id, hashToken(token), new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000));

  const bot = await telegramApi('getMe', {});
  res.json({
    completed: false,
    telegram_url: 'https://t.me/' + bot.username + '?start=' + encodeURIComponent(buildTaskToken(taskId, token)),
    channel_username: CHANNEL_USERNAME,
    channel_url: CHANNEL_URL,
    expires_in_seconds: TOKEN_TTL_MINUTES * 60,
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
    await Activity.log({ userId, actionType: 'task_completed', points: task.points, note: `Completed Telegram task: ${task.title}` });
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
  const command = text.trim().toLowerCase();

  // First-contact welcome: every new Telegram user receives the welcome and
  // risk disclosure once, regardless of whether they are linked to Top-Tier.
  if (message?.from?.id) {
    try {
      const welcome = await db.query(
        `INSERT INTO telegram_welcomes (telegram_user_id, telegram_username)
         VALUES ($1, $2)
         ON CONFLICT (telegram_user_id) DO NOTHING
         RETURNING telegram_user_id`,
        [message.from.id, normalizeTelegramUsername(message.from.username)]
      );
      if (welcome.rowCount > 0) {
        await telegramApi('sendMessage', {
          chat_id: message.chat.id,
          text: 'Welcome to Top-Tier! 👋\\n\\nWe are glad to have you here. You can complete tasks, earn points and use our demo terminal to practise trading.\\n\\n⚠️ RISK DISCLOSURE\\nTrading involves substantial risk of loss. Demo results are not real profits and do not guarantee future results. Never trade money you cannot afford to lose. Top-Tier does not provide financial advice.',
        });
      }
    } catch (error) {
      console.error('[telegram] first-contact welcome failed:', error.message);
    }
  }

  // Public bot welcome + trading risk disclosure. Token-specific verification
  // continues below so existing verification/task flows are preserved.
  if (command === '/start' || command.startsWith('/start ')) {
    await telegramApi('sendMessage', {
      chat_id: message.chat.id,
      text: 'Welcome to Top-Tier! 👋\n\nComplete tasks, track your points and use the demo terminal to practise.\n\n⚠️ RISK DISCLOSURE: Trading involves substantial risk of loss. Demo results are not real profits and do not guarantee future results. Never trade money you cannot afford to lose. Top-Tier does not provide financial advice.',
    }).catch(() => {});
  }

  if (command === '/daily' || command === '/contribution' || command === '/dailycontribution') {
    const telegramUser = await User.findByTelegramUserId(message.from.id);
    if (!telegramUser) {
      await telegramApi('sendMessage', {
        chat_id: message.chat.id,
        text: 'Your Telegram account is not verified with Top-Tier yet. Use the Telegram verification flow from your Top-Tier profile first.',
      }).catch(() => {});
      return;
    }
    await telegramApi('sendMessage', {
      chat_id: message.chat.id,
      text: `📊 Daily contribution confirmation\n\nToday: ${Number(telegramUser.daily_points || 0).toLocaleString()} pts\nTotal earnings: ${Number(telegramUser.total_points || 0).toLocaleString()} pts\n\nYour Top-Tier daily contribution has been confirmed from the account linked to this Telegram.`,
    }).catch(() => {});
    return;
  }

  if (!message?.from || !match?.[1]) return;

  const parsedStart = parseTaskToken(match[1].trim());
  const verification = await User.findByTelegramVerificationToken(hashToken(parsedStart.token));
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

  if (parsedStart.taskId) {
    const task = await Task.findById(parsedStart.taskId);
    if (task && task.is_active && task.task_type === 'telegram') {
      const existing = await TaskSubmission.findExisting(task.id, verification.user_id);
      if (!existing) {
        await TaskSubmission.create({ taskId: task.id, userId: verification.user_id, proofUrl: null });
        await db.query(`UPDATE task_submissions SET status = 'approved', reviewed_at = NOW() WHERE task_id = $1 AND user_id = $2`, [task.id, verification.user_id]);
        await Activity.log({ userId: verification.user_id, actionType: 'task_completed', points: task.points, note: `Completed Telegram task: ${task.title}` });
        await User.addPoints(verification.user_id, task.points);
      }
    }
  } else {
    await awardTelegramTasks(verification.user_id, telegramUserId);
  }

  const verifiedUser = await User.findById(verification.user_id);
  if (!verifiedUser.telegram_verified_at) return;
  const alreadyAwarded = await db.query(`SELECT 1 FROM activities WHERE user_id = $1 AND action_type = 'telegram_verification_bonus' LIMIT 1`, [verification.user_id]);
  if (alreadyAwarded.rowCount === 0) {
    const POINTS = require('../config/points');
    await db.query(`INSERT INTO activities (user_id, action_type, points, note) VALUES ($1, 'telegram_verification_bonus', $2, 'Telegram verification bonus')`, [verification.user_id, POINTS.telegram_verification_bonus]);
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
  startTelegramTask,
  configureTelegramWebhook,
};
