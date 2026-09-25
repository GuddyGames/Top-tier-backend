const db = require('../config/db');

const Task = {
  async create({ title, description, link, points, createdBy }) {
    const { rows } = await db.query(
      `INSERT INTO tasks (title, description, link, points, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [title, description || null, link || null, points, createdBy]
    );
    return rows[0];
  },

  async listActive() {
    const { rows } = await db.query(
      `SELECT id, title, description, link, points, task_date, created_at
       FROM tasks WHERE is_active = true AND task_date = CURRENT_DATE
       ORDER BY created_at DESC`
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async deactivate(id) {
    const { rows } = await db.query(
      'UPDATE tasks SET is_active = false WHERE id = $1 RETURNING id, is_active',
      [id]
    );
    return rows[0] || null;
  },
};

module.exports = Task;
