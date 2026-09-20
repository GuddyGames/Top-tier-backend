-- =========================================================
-- Catch-up patch — safe to run any number of times.
-- Paste into Supabase → SQL Editor → Run.
-- Adds columns/tables this project has picked up since your last
-- migration, without touching any existing rows.
-- =========================================================

ALTER TABLE demo_trades ADD COLUMN IF NOT EXISTS stop_loss NUMERIC(14, 5);
ALTER TABLE demo_trades ADD COLUMN IF NOT EXISTS take_profit NUMERIC(14, 5);
ALTER TABLE demo_trades ADD COLUMN IF NOT EXISTS close_reason VARCHAR(20);

CREATE TABLE IF NOT EXISTS demo_price_history (
    id              SERIAL PRIMARY KEY,
    symbol          VARCHAR(20) NOT NULL,
    price           NUMERIC(14, 5) NOT NULL,
    recorded_at     TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_demo_price_history_symbol_time ON demo_price_history(symbol, recorded_at);

-- New instruments — inserts only what's missing.
INSERT INTO demo_symbol_prices (symbol, price) VALUES
    ('XAU/USD', 2650.00),
    ('XAG/USD', 31.50),
    ('AUD/USD', 0.65500),
    ('USD/CAD', 1.37000),
    ('SOL/USD', 145.00)
ON CONFLICT (symbol) DO NOTHING;
