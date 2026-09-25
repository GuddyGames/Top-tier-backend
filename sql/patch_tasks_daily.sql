-- Add daily task date to existing production databases.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_date DATE NOT NULL DEFAULT CURRENT_DATE;
CREATE INDEX IF NOT EXISTS idx_tasks_active_date ON tasks(is_active, task_date);
