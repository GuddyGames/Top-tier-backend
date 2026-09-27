const cron = require('node-cron');
const User = require('../models/User');
const db = require('../config/db');
const CHANNEL_USERNAME = process.env.TELEGRAM_CHANNEL_USERNAME || '@Toptiertradingchannel';
const telegramApi = async (method, body) => {
  const response = await fetch('https://api.telegram.org/bot' + process.env.TELEGRAM_BOT_TOKEN + '/' + method, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.description || 'Telegram API request failed');
  return data.result;
};

const TIMEZONE = process.env.TELEGRAM_TIMEZONE || 'Africa/Lagos';
const ADMIN_IDS = () => String(process.env.TELEGRAM_ADMIN_CHAT_IDS || process.env.TELEGRAM_ADMIN_CHAT_ID || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

const RISK_DISCLOSURE =
  '⚠️ RISK DISCLOSURE\nTrading involves substantial risk of loss. Demo results are not real profits and do not guarantee future results. Never trade money you cannot afford to lose. Top-Tier does not provide financial advice.';

async function sendToAdmins(text) {
  const ids = ADMIN_IDS();
  if (!ids.length) {
    console.warn('[telegramAutomation] no admin chat IDs configured');
    return;
  }
  await Promise.all(ids.map((chatId) =>
    telegramApi('sendMessage', { chat_id: chatId, text }).catch((error) => {
      console.error(`[telegramAutomation] admin notification failed for ${chatId}: ${error.message}`);
    })
  ));
}

async function claimJob(jobKey) {
  const result = await db.query(
    `INSERT INTO telegram_automation_logs (job_key)
     VALUES ($1)
     ON CONFLICT (job_key) DO NOTHING
     RETURNING job_key`,
    [jobKey]
  );
  return result.rowCount > 0;
}

async function postGoodMorning() {
  const key = `good-morning:${new Date().toISOString().slice(0, 10)}`;
  if (!(await claimJob(key))) return;

  await telegramApi('sendMessage', {
    chat_id: CHANNEL_USERNAME,
    text: '🌅 Good morning, Top-Tier family!\n\nA new day is here. Complete your tasks, build your points and keep climbing the leaderboard. Have a productive day! 🚀',
  });
  console.log('[telegramAutomation] good morning posted');
}

async function postWeeklyLeaderboard() {
  const date = new Date().toISOString().slice(0, 10);
  const key = `weekly-leaderboard:${date}`;
  if (!(await claimJob(key))) return;

  const top = await User.getLeaderboard({ limit: 3, offset: 0 });
  if (!top.length) {
    await telegramApi('sendMessage', {
      chat_id: CHANNEL_USERNAME,
      text: '🏆 TOP-TIER WEEKLY LEADERBOARD\n\nNo leaderboard entries yet. Keep completing tasks and earning points!',
    });
    return;
  }

  const medals = ['🥇', '🥈', '🥉'];
  const lines = top.map((user, index) =>
    `${medals[index]} ${index + 1}. @${user.telegram_username || user.username} — ${Number(user.total_points || 0).toLocaleString()} pts`
  );

  await telegramApi('sendMessage', {
    chat_id: CHANNEL_USERNAME,
    text: `🏆 TOP-TIER TOP 3 OF THE WEEK\n\n${lines.join('\n')}\n\nKeep going — your name could be here next week! 🚀`,
  });
  console.log('[telegramAutomation] weekly leaderboard posted');
}

function scheduleTelegramAutomation() {
  cron.schedule('0 8 * * *', postGoodMorning, { timezone: TIMEZONE });
  cron.schedule('0 20 * * 0', postWeeklyLeaderboard, { timezone: TIMEZONE });
  console.log(`[telegramAutomation] scheduled: Good Morning 08:00 and weekly Top 3 Sunday 20:00 (${TIMEZONE})`);
}

async function handleChannelMemberUpdate(update) {
  const member = update?.chat_member;
  if (!member?.chat || !member?.new_chat_member?.user) return false;

  const newStatus = member.new_chat_member.status;
  const oldStatus = member.old_chat_member?.status;
  const joined = ['member', 'administrator', 'creator'].includes(newStatus)
    && ['left', 'kicked'].includes(oldStatus || 'left');

  if (!joined) return false;

  const user = member.new_chat_member.user;
  const username = user.username ? ` @${user.username}` : '';
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'there';

  const welcome = `🎉 Welcome ${displayName}!${username}\n\nWelcome to Top-Tier! We're glad to have you here. Complete tasks, earn points and practise with the demo terminal.\n\n${RISK_DISCLOSURE}`;
  await telegramApi('sendMessage', { chat_id: member.chat.id, text: welcome });

  await sendToAdmins(
    `👤 New Top-Tier channel member\n\nName: ${displayName}\nTelegram: ${username || 'No username'}\nTelegram ID: ${user.id}\nChannel: ${member.chat.title || CHANNEL_USERNAME}`
  );

  return true;
}

module.exports = {
  scheduleTelegramAutomation,
  handleChannelMemberUpdate,
  postGoodMorning,
  postWeeklyLeaderboard,
  sendToAdmins,
};