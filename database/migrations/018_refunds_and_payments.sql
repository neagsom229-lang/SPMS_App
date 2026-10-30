-- Migration 018: Refunds and KHQR Sessions DB Persistence

-- 1. Add refunded_amount to tbl_order_items for partial refunds
ALTER TABLE tbl_order_items ADD COLUMN IF NOT EXISTS refunded_amount DECIMAL(10,2) DEFAULT 0;

-- 2. KHQR Sessions table with TTL
CREATE TABLE IF NOT EXISTS khqr_sessions (
    session_id VARCHAR(100) PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    order_id INTEGER REFERENCES tbl_orders(or_id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    status VARCHAR(50) DEFAULT 'PENDING',
    confirmed_by INTEGER REFERENCES tbl_users(userid),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_khqr_sessions_tenant ON khqr_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_khqr_sessions_expiry ON khqr_sessions(expires_at);
