-- Parallax module: isolated from Top-tier points, contributions and demo wallet.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS parallax_plan VARCHAR(20) NOT NULL DEFAULT 'free';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_parallax_plan_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_parallax_plan_check
      CHECK (parallax_plan IN ('free', 'premium'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS parallax_signal_history (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol VARCHAR(24) NOT NULL,
  timeframe VARCHAR(5) NOT NULL,
  direction VARCHAR(8) NOT NULL CHECK (direction IN ('BUY', 'SELL', 'WAIT')),
  regime VARCHAR(24) NOT NULL,
  data_source VARCHAR(80) NOT NULL,
  analyzed_at TIMESTAMPTZ NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parallax_history_user_time
  ON parallax_signal_history(user_id, analyzed_at DESC);
