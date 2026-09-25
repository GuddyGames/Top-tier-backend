const db = require('../config/db');
const User = require('../models/User');
const Activity = require('../models/Activity');
const DemoTrade = require('../models/DemoTrade');
const TaskSubmission = require('../models/TaskSubmission');
const asyncHandler = require('../utils/asyncHandler');
const { createSignedUrl } = require('../utils/taskProofStorage');

// GET /api/admin/users?limit=50&offset=0&search=
// A full oversight list: points, streak, referrals, task/demo activity
// at a glance, so an admin can see everyone's progress in one place.
const listUsers = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const offset = parseInt(req.query.offset, 10) || 0;
  const search = req.query.search ? `%${req.query.search}%` : null;

  const { rows } = await db.query(
    `SELECT u.id, u.username, u.email, u.telegram_username, u.status, u.role,
            u.total_contribution, u.total_points, u.daily_points, u.current_streak, u.rank, u.created_at,
            (SELECT COUNT(*)::int FROM users r WHERE r.referred_by = u.id) AS referral_count,
            (SELECT COUNT(*)::int FROM task_submissions ts WHERE ts.user_id = u.id AND ts.status = 'pending') AS pending_tasks
     FROM users u
     WHERE $3::text IS NULL OR u.username ILIKE $3 OR u.email ILIKE $3
     ORDER BY u.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset, search]
  );

  res.json({ users: rows, limit, offset });
});

// PATCH /api/admin/users/:id/contribution — Body: { contribution }
// Admin-only override of the leaderboard contribution value.
const updateUserContribution = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const contribution = Number(req.body.contribution);

  if (!Number.isFinite(contribution) || contribution < 0) {
    return res.status(400).json({ error: 'contribution must be a valid non-negative number' });
  }

  const updated = await User.updateContribution(userId, contribution);
  if (!updated) return res.status(404).json({ error: 'User not found' });

  res.json({ user: updated });
});

// DELETE /api/admin/users/:id — permanently removes a user and user-owned data.
const deleteUserAccount = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  if (userId === Number(req.user.id)) {
    return res.status(400).json({ error: 'You cannot delete your own admin account here' });
  }

  const result = await User.deleteAccount(userId);
  if (!result.deleted && result.reason === 'not_found') {
    return res.status(404).json({ error: 'User not found' });
  }
  if (!result.deleted && result.reason === 'last_admin') {
    return res.status(409).json({ error: 'The last admin account cannot be deleted' });
  }

  res.json({ deleted: true, user_id: userId });
});

// GET /api/admin/users/:id — full detail view: profile + recent activity
// + task submissions + demo trading summary, for reviewing one user.
const getUserDetail = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const [referralCount, recentActivities, demoSummary] = await Promise.all([
    User.countReferrals(user.id),
    Activity.recentForUser(user.id, 25),
    DemoTrade.summaryForUser(user.id),
  ]);

  res.json({ user, referral_count: referralCount, recent_activities: recentActivities, demo_summary: demoSummary });
});

// PATCH /api/admin/users/:id/status — Body: { status: "active" | "inactive" }
const updateUserStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['active', 'inactive'].includes(status)) {
    return res.status(400).json({ error: 'status must be "active" or "inactive"' });
  }

  const { rows } = await db.query(
    'UPDATE users SET status = $2 WHERE id = $1 RETURNING id, status',
    [req.params.id, status]
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json({ user: rows[0] });
});

// POST /api/admin/users/:id/score — Body: { points, note? }
// Manual point adjustment so an admin can score a user based on
// performance they observed (quality of demo trades, task effort, etc.)
// that doesn't map to one of the fixed activity types. points can be
// negative to deduct. Logged as an activity with a note for the trail.
const scoreUser = asyncHandler(async (req, res) => {
  const { points, note } = req.body;
  const userId = req.params.id;

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  await Activity.log({ userId, actionType: 'admin_adjustment', points, note });
  const updated = await User.addPoints(userId, points);

  res.status(201).json({ total_points: updated.total_points, points_applied: points });
});

// PATCH /api/admin/users/:id — Body: { username?, telegramUsername? }
// Correct a typo, resolve a duplicate-looking name, etc. Leaderboard
// fields that are computed (rank) or historical (joined date) aren't
// exposed here — editing them wouldn't mean anything; rank gets
// recalculated nightly regardless, and joined date is just what happened.
const updateUserProfile = asyncHandler(async (req, res) => {
  const { username, telegramUsername } = req.body;
  if (username === undefined && telegramUsername === undefined) {
    return res.status(400).json({ error: 'Provide username and/or telegramUsername' });
  }

  const user = await User.adminUpdateProfile(req.params.id, { username, telegramUsername });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

// GET /api/admin/activity?limit=50 — every user's recent activity, one feed.
const getGlobalActivity = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const activities = await Activity.recentGlobal(limit);
  res.json({ activities });
});

// GET /api/admin/trades?limit=50&status=open|closed — every user's demo trades.
const getGlobalTrades = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const status = ['open', 'closed'].includes(req.query.status) ? req.query.status : undefined;
  const trades = await DemoTrade.recentGlobal({ limit, status });
  res.json({ trades });
});

// GET /api/admin/tasks/pending — every pending task submission, across tasks.
const getPendingSubmissions = asyncHandler(async (req, res) => {
  const submissions = await TaskSubmission.listAllPending();
  for (const submission of submissions) {
    if (submission.proof_url) {
      let isHttpUrl = false;
      try {
        const parsedUrl = new URL(submission.proof_url);
        isHttpUrl = parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
      } catch {
        isHttpUrl = false;
      }

      if (!isHttpUrl) {
        submission.proof_url = await createSignedUrl(submission.proof_url);
      }
    }
  }
  res.json({ submissions });
});


// GET /api/admin/tasks/outstanding — users who have not submitted each active task.
const getOutstandingTasks = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);
  const { rows } = await db.query(
    `SELECT t.id AS task_id, t.title AS task_title, t.points,
            u.id AS user_id, u.username, u.email
     FROM tasks t
     CROSS JOIN users u
     LEFT JOIN task_submissions ts
       ON ts.task_id = t.id AND ts.user_id = u.id
     WHERE t.is_active = true
       AND t.task_date = CURRENT_DATE
       AND u.status = 'active'
       AND ts.id IS NULL
     ORDER BY t.created_at DESC, u.username ASC
     LIMIT $1`,
    [limit]
  );
  res.json({ outstanding: rows });
});

const listReferrals = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);
  const { rows } = await db.query(
    'SELECT r.id AS referral_id, r.created_at AS joined_at, ref.id AS referrer_id, ref.username AS referrer_username, ref.email AS referrer_email, ref.telegram_username AS referrer_telegram_username, r.username AS referred_username, r.email AS referred_email, r.telegram_username AS referred_telegram_username FROM users r JOIN users ref ON ref.id = r.referred_by ORDER BY r.created_at DESC LIMIT $1',
    [limit]
  );
  res.json({ referrals: rows });
});

module.exports = {
  listUsers,
  listReferrals,
  getUserDetail,
  updateUserStatus,
  updateUserProfile,
  updateUserContribution,
  deleteUserAccount,
  scoreUser,
  getGlobalActivity,
  getGlobalTrades,
  getPendingSubmissions,
  getOutstandingTasks,
};
