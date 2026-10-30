-- Migration 024: KHQR Sessions and User Subscriptions
CREATE TABLE IF NOT EXISTS khqr_sessions (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(255) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES tbl_users(userid) ON DELETE CASCADE,
    plan VARCHAR(100),
    amount DECIMAL(10, 2) NOT NULL,
    md5 VARCHAR(255) UNIQUE NOT NULL,
    qr_string TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'UNPAID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP
);

ALTER TABLE tbl_users ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(100);
ALTER TABLE tbl_users ADD COLUMN IF NOT EXISTS subscription_expires TIMESTAMP;
