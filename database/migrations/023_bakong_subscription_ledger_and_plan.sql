-- Migration 023: Tenant Plan, Subscription Ledger, Webhook Events, and Strict Constraints
-- Idempotent SQL

-- 1. Ensure tenants table has plan and plan_expires_at
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'FREE';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP;

-- 2. Create khqr_sessions table if not exists with id SERIAL PRIMARY KEY
CREATE TABLE IF NOT EXISTS khqr_sessions (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(255),
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE RESTRICT,
    user_id INTEGER REFERENCES tbl_users(userid) ON DELETE RESTRICT,
    plan VARCHAR(100),
    period_months INTEGER DEFAULT 1,
    amount DECIMAL(10, 2),
    expected_amount DECIMAL(10, 2),
    currency VARCHAR(10) DEFAULT 'USD',
    md5 VARCHAR(255),
    bakong_hash VARCHAR(255) NULL,
    qr_string TEXT,
    status VARCHAR(50) DEFAULT 'PENDING',
    expires_at TIMESTAMP,
    paid_at TIMESTAMP,
    verified_by VARCHAR(100),
    raw_response JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ensure all columns exist
ALTER TABLE khqr_sessions ADD COLUMN IF NOT EXISTS id SERIAL;
ALTER TABLE khqr_sessions ADD COLUMN IF NOT EXISTS order_id VARCHAR(255);
ALTER TABLE khqr_sessions ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE RESTRICT;
ALTER TABLE khqr_sessions ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES tbl_users(userid) ON DELETE RESTRICT;
ALTER TABLE khqr_sessions ADD COLUMN IF NOT EXISTS plan VARCHAR(100);
ALTER TABLE khqr_sessions ADD COLUMN IF NOT EXISTS period_months INTEGER DEFAULT 1;
ALTER TABLE khqr_sessions ADD COLUMN IF NOT EXISTS amount DECIMAL(10, 2);
ALTER TABLE khqr_sessions ADD COLUMN IF NOT EXISTS expected_amount DECIMAL(10, 2);
ALTER TABLE khqr_sessions ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'USD';
ALTER TABLE khqr_sessions ADD COLUMN IF NOT EXISTS md5 VARCHAR(255);
ALTER TABLE khqr_sessions ADD COLUMN IF NOT EXISTS bakong_hash VARCHAR(255) NULL;
ALTER TABLE khqr_sessions ADD COLUMN IF NOT EXISTS qr_string TEXT;
ALTER TABLE khqr_sessions ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'PENDING';
ALTER TABLE khqr_sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;
ALTER TABLE khqr_sessions ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;
ALTER TABLE khqr_sessions ADD COLUMN IF NOT EXISTS verified_by VARCHAR(100);
ALTER TABLE khqr_sessions ADD COLUMN IF NOT EXISTS raw_response JSONB;
ALTER TABLE khqr_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add unique indexes on md5 and bakong_hash
CREATE UNIQUE INDEX IF NOT EXISTS idx_khqr_sessions_md5_unique ON khqr_sessions(md5) WHERE md5 IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_khqr_sessions_bakong_hash_unique ON khqr_sessions(bakong_hash) WHERE bakong_hash IS NOT NULL;

-- Add check constraint for status if not exists (NOT VALID)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE table_name = 'khqr_sessions' AND constraint_name = 'chk_khqr_sessions_status'
    ) THEN
        ALTER TABLE khqr_sessions ADD CONSTRAINT chk_khqr_sessions_status 
        CHECK (status IN ('PENDING', 'PAID', 'EXPIRED', 'FAILED_MISMATCH', 'PAID_LATE')) NOT VALID;
    END IF;
END $$;

-- 3. Create payment_webhook_events table for idempotency
CREATE TABLE IF NOT EXISTS payment_webhook_events (
    event_id VARCHAR(255) UNIQUE PRIMARY KEY,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_khqr_sessions_tenant_status ON khqr_sessions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_khqr_sessions_status_expiry ON khqr_sessions(status, expires_at);
