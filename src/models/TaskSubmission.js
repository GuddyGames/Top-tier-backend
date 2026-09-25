const db = require('../config/db');

const TaskSubmission = {
  async create({ taskId, userId, proofUrl }) {
    const { rows } = await db.query(
      `INSERT INTO task_submissions (task_id, user_id, proof_url)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [taskId, userId, proofUrl || null]
    );
    return rows[0];
  },

  async findExisting(taskId, userId) {
    const { rows } = await db.query(
      'SELECT * FROM task_submissions WHERE task_id = $1 AND user_id = $2',
      [taskId, userId]
    );
    return rows[0] || null;
  },

  async listForTask(taskId) {
    const { rows } = await db.query(
      `SELECT ts.id, ts.status, ts.proof_url, ts.submitted_at, u.id AS user_id, u.username
       FROM task_submissions ts
       JOIN users u ON u.id = ts.user_id
       WHERE ts.task_id = $1
       ORDER BY ts.submitted_at DESC`,
      [taskId]
    );
    return rows;
  },

  async listForUser(userId) {
    const { rows } = await db.query(
      `SELECT ts.id, ts.status, ts.proof_url, ts.submitted_at, t.title, t.points
       FROM task_submissions ts
       JOIN tasks t ON t.id = ts.task_id
       WHERE ts.user_id = $1
       ORDER BY ts.submitted_at DESC`,
      [userId]
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await db.query('SELECT * FROM task_submissions WHERE id = $1', [id]);
    return rows[0] || null;
  },

  // Admin oversight — pending submissions across every task in one list,
  // instead of checking task-by-task.
  async listAllPending(limit = 50) {
    const { rows } = await db.query(
      `SELECT ts.id, ts.task_id, ts.proof_url, ts.submitted_at,
              u.id AS user_id, u.username, t.title AS task_title, t.points
       FROM task_submissions ts
       JOIN users u ON u.id = ts.user_id
       JOIN tasks t ON t.id = ts.task_id
       WHERE ts.status = 'pending'
       ORDER BY ts.submitted_at ASC
       LIMIT $1`,
      [limit]
    );
    return rows;
  },

  async setStatus(id, status, reviewedBy) {
    const { rows } = await db.query(
      `UPDATE task_submissions
       SET status = $2, reviewed_at = NOW(), reviewed_by = $3
       WHERE id = $1
       RETURNING *`,
      [id, status, reviewedBy]
    );
    return rows[0];
  },
};

module.exports = TaskSubmission;
