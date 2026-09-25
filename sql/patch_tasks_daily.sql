-- Add daily task date to existing production databases.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_date DATE NOT NULL DEFAULT CURRENT_DATE;
CREATE INDEX IF NOT EXISTS idx_tasks_active_date ON tasks(is_active, task_date);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_type VARCHAR(20) NOT NULL DEFAULT 'manual';
CREATE INDEX IF NOT EXISTS idx_tasks_type_active_date ON tasks(task_type, is_active, task_date);
