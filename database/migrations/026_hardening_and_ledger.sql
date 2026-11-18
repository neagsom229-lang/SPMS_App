-- Migration 026: Hardening and Ledger Constraints
-- Idempotent and safe on both fresh local DB and live

DO $$
BEGIN
    -- Make order_id and qr_string nullable for subscription sessions
    ALTER TABLE IF EXISTS khqr_sessions ALTER COLUMN order_id DROP NOT NULL;
    ALTER TABLE IF EXISTS khqr_sessions ALTER COLUMN qr_string DROP NOT NULL;

    -- Ensure tbl_activity_logs has details column
    ALTER TABLE IF EXISTS tbl_activity_logs ADD COLUMN IF NOT EXISTS details TEXT;
END $$;

-- khqr_webhook_events is intentionally NOT created here: the webhook route was
-- deleted and nothing reads this table. Migration 023 still creates it on the
-- replay path, so removing it from 026 is a no-op for databases that ran 023.

-- Phase 12d: append the two khqr_sessions indexes from migration 018 (genuine
-- misses that were never applied on live). 026 is pending on live, not yet applied.
CREATE INDEX IF NOT EXISTS idx_khqr_sessions_tenant ON khqr_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_khqr_sessions_expiry ON khqr_sessions(expires_at);
