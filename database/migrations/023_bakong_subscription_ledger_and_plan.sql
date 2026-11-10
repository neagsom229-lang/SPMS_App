-- Migration 023: Tenant Plan, Subscription Ledger, Webhook Events, and Strict Constraints
-- Idempotent SQL

-- 0. Reconcile the early khqr_sessions shape created by migration 018
--    (session_id PK + order_id INTEGER) with the ledger shape the application
--    uses (id PK + order_id VARCHAR). Safe on both fresh and already-upgraded DBs.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'khqr_sessions' AND column_name = 'session_id'
    ) THEN
        ALTER TABLE khqr_sessions DROP COLUMN session_id CASCADE;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'khqr_sessions'
          AND column_name = 'order_id' AND data_type = 'integer'
    ) THEN
        ALTER TABLE khqr_sessions DROP CONSTRAINT IF EXISTS khqr_sessions_order_id_fkey;
        ALTER TABLE khqr_sessions ALTER COLUMN order_id TYPE VARCHAR(255) USING order_id::text;
    END IF;
END $$;

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

-- The application addresses sessions by id. Migration 018 used session_id as PK,
-- so make sure the reconciled table has an id primary key.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public' AND table_name = 'khqr_sessions'
          AND constraint_type = 'PRIMARY KEY'
    ) THEN
        ALTER TABLE khqr_sessions ADD CONSTRAINT khqr_sessions_pkey PRIMARY KEY (id);
    END IF;
END $$;

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

-- 3. Create khqr_webhook_events table for idempotency
CREATE TABLE IF NOT EXISTS khqr_webhook_events (
    event_id VARCHAR(255) UNIQUE PRIMARY KEY,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 022 already ran when this table was created on the upgrade path, so enable
-- RLS here to keep the replay path byte-for-byte identical.
ALTER TABLE khqr_webhook_events ENABLE ROW LEVEL SECURITY;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_khqr_sessions_tenant_status ON khqr_sessions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_khqr_sessions_status_expiry ON khqr_sessions(status, expires_at);
