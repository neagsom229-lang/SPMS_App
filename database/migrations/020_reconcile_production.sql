-- Migration 020: Reconcile production schema drift non-destructively
-- Using ADD COLUMN IF NOT EXISTS only (no drops, no destructive changes)

-- 1. Reconcile store_settings table
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS opening_hours JSONB DEFAULT '{}'::jsonb;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) DEFAULT 0.00;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 2. Reconcile tbl_stock_log table
ALTER TABLE tbl_stock_log ADD COLUMN IF NOT EXISTS type VARCHAR(50);
ALTER TABLE tbl_stock_log ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(50);
ALTER TABLE tbl_stock_log ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50) DEFAULT 'ORDER';
ALTER TABLE tbl_stock_log ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE tbl_stock_log ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE tbl_stock_log ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
