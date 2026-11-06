-- Migration 026: Hardening and Ledger Constraints
-- Idempotent and safe on both fresh local DB and live

DO $$
BEGIN
    -- Make order_id and qr_string nullable for subscription sessions
    ALTER TABLE IF EXISTS khqr_sessions ALTER COLUMN order_id DROP NOT NULL;
    ALTER TABLE IF EXISTS khqr_sessions ALTER COLUMN qr_string DROP NOT NULL;

    -- Ensure unique index on bakong_hash (partial where not null) if not exists
    CREATE UNIQUE INDEX IF NOT EXISTS idx_khqr_sessions_bakong_hash_unique ON khqr_sessions(bakong_hash) WHERE bakong_hash IS NOT NULL;

    -- Ensure unique index on md5 (regular unique index to support ON CONFLICT (md5)) if not exists
    CREATE UNIQUE INDEX IF NOT EXISTS idx_khqr_sessions_md5_unique ON khqr_sessions(md5);

    -- Ensure tbl_activity_logs has details column
    ALTER TABLE IF EXISTS tbl_activity_logs ADD COLUMN IF NOT EXISTS details TEXT;
END $$;

-- Create webhook events idempotency table if not exists
CREATE TABLE IF NOT EXISTS khqr_webhook_events (
    event_id VARCHAR(255) PRIMARY KEY,
    created_at TIMESTAMP DEFAULT NOW()
);
