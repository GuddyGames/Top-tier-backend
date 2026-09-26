-- =========================================================
-- Leaderboard Backend — PostgreSQL Schema
-- =========================================================

CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(50) UNIQUE NOT NULL,
    email           VARCHAR(100) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    telegram_username VARCHAR(50),
    role            VARCHAR(20) NOT NULL DEFAULT 'user', -- 'user' or 'admin'
    status          VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active' or 'inactive'
    referral_code   VARCHAR(20) UNIQUE NOT NULL,
    referred_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    telegram_user_id BIGINT UNIQUE,
    telegram_verified_at TIMESTAMP,
    telegram_verification_token_hash VARCHAR(64),
    telegram_verification_expires_at TIMESTAMP,
    -- Placeholder only — not wired to any real deposit/payout logic yet.
    -- Populate this once the trading/investment mechanism is defined.
    total_contribution NUMERIC(14, 2) NOT NULL DEFAULT 0,
    total_points    INTEGER NOT NULL DEFAULT 0,
    daily_points    INTEGER NOT NULL DEFAULT 0,
    current_streak  INTEGER NOT NULL DEFAULT 0,
    longest_streak  INTEGER NOT NULL DEFAULT 0,
    last_active_date DATE,
    rank            INTEGER,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activities (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type     VARCHAR(50) NOT NULL,
    points          INTEGER NOT NULL,
    note            TEXT,               -- e.g. reason for an admin manual adjustment
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Stores a daily snapshot of standings so the dashboard can show
-- historical trends / "top movers" without re-scanning activities.
CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    snapshot_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    total_points    INTEGER NOT NULL,
    rank            INTEGER NOT NULL,
    UNIQUE (user_id, snapshot_date)
);

-- Social-media engagement tasks posted by admins (like/comment/reshare a post, etc).
CREATE TABLE IF NOT EXISTS tasks (
    id              SERIAL PRIMARY KEY,
    title           VARCHAR(150) NOT NULL,
    description     TEXT,
    link            TEXT,               -- URL of the post to engage with
    points          INTEGER NOT NULL,
    task_type       VARCHAR(20) NOT NULL DEFAULT 'manual', -- manual | telegram
    created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    task_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_type VARCHAR(20) NOT NULL DEFAULT 'manual';

-- Tracks Telegram users who have already received the first-contact welcome.
CREATE TABLE IF NOT EXISTS telegram_welcomes (
    telegram_user_id BIGINT PRIMARY KEY,
    telegram_username VARCHAR(255),
    welcomed_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_type_active_date ON tasks(task_type, is_active, task_date);

-- A user's claim that they completed a task. Social actions (likes, comments,
-- reshares) can't be verified automatically without each platform's API, so
-- submissions are reviewed by an admin before points are awarded.
CREATE TABLE IF NOT EXISTS task_submissions (
    id              SERIAL PRIMARY KEY,
    task_id         INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    proof_url       TEXT,               -- screenshot link or note from the user
    status          VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | approved | rejected
    submitted_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    reviewed_at     TIMESTAMP,
    reviewed_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE (task_id, user_id)
);

-- ---------------------------------------------------------------
-- Demo / practice trading (no real money — for beginners to learn on)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS demo_accounts (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance         NUMERIC(14, 2) NOT NULL DEFAULT 10000, -- virtual starting balance
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Simulated instrument prices. A cron tick (see jobs/priceTickJob.js)
-- nudges these with a small random walk so practice trades have
-- something to move against. Swap this for a real market-data feed
-- later without touching the trade open/close logic.
CREATE TABLE IF NOT EXISTS demo_symbol_prices (
    symbol          VARCHAR(20) PRIMARY KEY,
    price           NUMERIC(14, 5) NOT NULL,
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO demo_symbol_prices (symbol, price) VALUES
    ('EUR/USD', 1.08500),
    ('GBP/USD', 1.27000),
    ('USD/JPY', 149.500),
    ('AUD/USD', 0.65500),
    ('USD/CAD', 1.37000),
    ('XAU/USD', 2650.00),
    ('XAG/USD', 31.50),
    ('BTC/USD', 62000.00),
    ('ETH/USD', 3400.00),
    ('SOL/USD', 145.00)
ON CONFLICT (symbol) DO NOTHING;

CREATE TABLE IF NOT EXISTS demo_trades (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol          VARCHAR(20) NOT NULL,
    side            VARCHAR(4) NOT NULL,  -- 'buy' or 'sell'
    size            NUMERIC(14, 4) NOT NULL,
    entry_price     NUMERIC(14, 5) NOT NULL,
    exit_price      NUMERIC(14, 5),
    stop_loss       NUMERIC(14, 5),  -- price that auto-closes the trade at a loss
    take_profit     NUMERIC(14, 5),  -- price that auto-closes the trade at a gain
    close_reason    VARCHAR(20),     -- 'manual' | 'stop_loss' | 'take_profit'
    status          VARCHAR(10) NOT NULL DEFAULT 'open', -- open | closed
    pnl             NUMERIC(14, 2),
    opened_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    closed_at       TIMESTAMP
);

-- Every simulated price tick, kept so the frontend can render a
-- candlestick chart (grouped into 1-minute candles on read) instead of
-- just the single current price. Same idea as real market tick data —
-- swap the writer for a real feed later and the read query is unchanged.
CREATE TABLE IF NOT EXISTS demo_price_history (
    id              SERIAL PRIMARY KEY,
    symbol          VARCHAR(20) NOT NULL,
    price           NUMERIC(14, 5) NOT NULL,
    recorded_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demo_trades_user ON demo_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_demo_trades_status ON demo_trades(status);
CREATE INDEX IF NOT EXISTS idx_demo_price_history_symbol_time ON demo_price_history(symbol, recorded_at);

CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at);
CREATE INDEX IF NOT EXISTS idx_users_total_points ON users(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);
CREATE INDEX IF NOT EXISTS idx_snapshots_date ON leaderboard_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_task_submissions_task ON task_submissions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_submissions_user ON task_submissions(user_id);
