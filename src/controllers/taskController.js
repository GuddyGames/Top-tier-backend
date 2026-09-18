const Task = require('../models/Task');
const TaskSubmission = require('../models/TaskSubmission');
const User = require('../models/User');
const Activity = require('../models/Activity');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/tasks — public, active tasks only
const listTasks = asyncHandler(async (req, res) => {
  const tasks = await Task.listActive();
  res.json({ tasks });
});

// POST /api/tasks — admin only
const createTask = asyncHandler(async (req, res) => {
  const { title, description, link, points } = req.body;
  const task = await Task.create({ title, description, link, points, createdBy: req.user.id });
  res.status(201).json({ task });
});

// PATCH /api/tasks/:id/deactivate — admin only
const deactivateTask = asyncHandler(async (req, res) => {
  const task = await Task.deactivate(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json({ task });
});

// POST /api/tasks/:id/submit — auth required
// Body: { proofUrl? }  — a screenshot link or note proving the action was done.
// Social actions (like/comment/reshare) can't be auto-verified, so this sits
// as "pending" until an admin reviews it via the endpoints below.
const submitTask = asyncHandler(async (req, res) => {
  const taskId = req.params.id;
  const task = await Task.findById(taskId);
  if (!task || !task.is_active) return res.status(404).json({ error: 'Task not found or inactive' });

  const existing = await TaskSubmission.findExisting(taskId, req.user.id);
  if (existing) return res.status(409).json({ error: 'You already submitted this task', submission: existing });

  const submission = await TaskSubmission.create({
    taskId,
    userId: req.user.id,
    proofUrl: req.body.proofUrl,
  });

  res.status(201).json({ submission });
});

// GET /api/tasks/me — auth required — the caller's own submissions
const mySubmissions = asyncHandler(async (req, res) => {
  const submissions = await TaskSubmission.listForUser(req.user.id);
  res.json({ submissions });
});

// GET /api/tasks/:id/submissions — admin only
const listSubmissions = asyncHandler(async (req, res) => {
  const submissions = await TaskSubmission.listForTask(req.params.id);
  res.json({ submissions });
});

// PATCH /api/tasks/submissions/:id — admin only. Body: { status: "approved" | "rejected" }
// Approving awards the task's points exactly once (guarded by the pending check).
const reviewSubmission = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'status must be "approved" or "rejected"' });
  }

  const submission = await TaskSubmission.findById(req.params.id);
  if (!submission) return res.status(404).json({ error: 'Submission not found' });
  if (submission.status !== 'pending') {
    return res.status(409).json({ error: `Submission already ${submission.status}` });
  }

  const updated = await TaskSubmission.setStatus(submission.id, status, req.user.id);

  if (status === 'approved') {
    const task = await Task.findById(submission.task_id);
    await Activity.log({ userId: submission.user_id, actionType: 'task_completed', points: task.points });
    await User.addPoints(submission.user_id, task.points);
  }

  res.json({ submission: updated });
});

module.exports = {
  listTasks,
  createTask,
  deactivateTask,
  submitTask,
  mySubmissions,
  listSubmissions,
  reviewSubmission,
};
