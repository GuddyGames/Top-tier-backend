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
      `SELECT ts.id, ts.task_id, ts.status, ts.proof_url, ts.submitted_at, t.title, t.points
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

  // Admin oversight — filterable submission queue across every task.
  // Status is whitelisted into the SQL text; search remains parameterized.
  async listAll({ status = 'all', search = '', limit = 50, offset = 0 } = {}) {
    const values = [];
    const where = [];

    if (['pending', 'approved', 'rejected'].includes(status)) {
      where.push(`ts.status = '${status}'`);
    }

    if (search) {
      values.push(`%${search}%`);
      const p = `$${values.length}`;
      where.push(`(u.username ILIKE ${p} OR u.email ILIKE ${p} OR t.title ILIKE ${p})`);
    }

    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 50));
    const safeOffset = Math.max(0, Number(offset) || 0);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const { rows } = await db.query(
      `SELECT ts.id, ts.task_id, ts.proof_url, ts.status, ts.submitted_at,
              ts.reviewed_at, ts.reviewed_by,
              u.id AS user_id, u.username, u.email, u.telegram_username,
              t.title AS task_title, t.points, t.task_type
       FROM task_submissions ts
       JOIN users u ON u.id = ts.user_id
       JOIN tasks t ON t.id = ts.task_id
       ${whereSql}
       ORDER BY CASE WHEN ts.status = 'pending' THEN 0 ELSE 1 END, ts.submitted_at DESC
       LIMIT ${safeLimit} OFFSET ${safeOffset}`,
      values
    );

    const { rows: countRows } = await db.query(
      `SELECT COUNT(*)::int AS count
       FROM task_submissions ts
       JOIN users u ON u.id = ts.user_id
       JOIN tasks t ON t.id = ts.task_id
       ${whereSql}`,
      values
    );

    return { submissions: rows, total: countRows[0]?.count || 0 };
  },

  async listAllPending(limit = 50) {
    return (await TaskSubmission.listAll({ status: 'pending', limit, offset: 0 })).submissions;
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
