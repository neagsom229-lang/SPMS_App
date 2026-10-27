-- Migration 019: Revert/Align schema changes previously edited in 002, 003, 006
ALTER TABLE tbl_stock_log ADD COLUMN IF NOT EXISTS type VARCHAR(50);
ALTER TABLE tbl_stock_log ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(50);
ALTER TABLE tbl_stock_log ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50) DEFAULT 'ORDER';
ALTER TABLE tbl_stock_log ALTER COLUMN reference_type DROP NOT NULL;
ALTER TABLE tbl_stock_log ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE tbl_stock_log ADD COLUMN IF NOT EXISTS notes TEXT;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tbl_products' AND column_name = 'status') THEN
        ALTER TABLE tbl_products ADD COLUMN status VARCHAR(50) DEFAULT 'Active';
    END IF;
    CREATE INDEX IF NOT EXISTS idx_products_tenant_status ON tbl_products(tenant_id, status);
END $$;
