-- Telegram verification fields. Safe to run on an existing database.
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_user_id BIGINT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_verified_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_verification_token_hash VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_verification_expires_at TIMESTAMP;
