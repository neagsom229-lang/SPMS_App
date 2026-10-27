-- Migration 003: Round 2 Hardening & Schema Reconciliation
-- Idempotent and non-destructive schema adjustments

-- 1. Ensure tbl_stock has tenant_id and required columns
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tbl_stock' AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE tbl_stock ADD COLUMN tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tbl_stock' AND column_name = 'qtyavailable'
    ) THEN
        ALTER TABLE tbl_stock ADD COLUMN qtyavailable INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tbl_stock' AND column_name = 'qtyinstock'
    ) THEN
        ALTER TABLE tbl_stock ADD COLUMN qtyinstock INTEGER DEFAULT 0;
    END IF;
END $$;

-- 2. Ensure tbl_stock_log exists with correct foreign keys referencing tbl_products(id)
CREATE TABLE IF NOT EXISTS tbl_stock_log (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES tbl_products(id) ON DELETE CASCADE,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    change_qty INTEGER NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    reference_type VARCHAR(50) NOT NULL,
    reference_id INTEGER,
    user_id INTEGER REFERENCES tbl_users(userid),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Ensure tbl_payment exists with foreign key referencing tbl_orders(or_id)
CREATE TABLE IF NOT EXISTS tbl_payment (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES tbl_orders(or_id) ON DELETE CASCADE,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'COMPLETED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Add buy_price / cost to tbl_order_items (or tbl_orders_details) for profit calculation
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'tbl_order_items'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tbl_order_items' AND column_name = 'buy_price'
        ) THEN
            ALTER TABLE tbl_order_items ADD COLUMN buy_price NUMERIC(12,2) DEFAULT 0;
        END IF;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'tbl_orders_details'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tbl_orders_details' AND column_name = 'buy_price'
        ) THEN
            ALTER TABLE tbl_orders_details ADD COLUMN buy_price NUMERIC(12,2) DEFAULT 0;
        END IF;
    END IF;
END $$;

-- 5. Add idempotency_key to tbl_orders if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tbl_orders' AND column_name = 'idempotency_key'
    ) THEN
        ALTER TABLE tbl_orders ADD COLUMN idempotency_key VARCHAR(100) UNIQUE;
    END IF;
END $$;

-- 6. Add performance indexes
CREATE INDEX IF NOT EXISTS idx_orders_tenant_date ON tbl_orders(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status ON tbl_orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_stock_product ON tbl_stock(productid);
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tbl_products' AND column_name = 'status') THEN
        ALTER TABLE tbl_products ADD COLUMN status VARCHAR(50) DEFAULT 'Active';
    END IF;
    CREATE INDEX IF NOT EXISTS idx_products_tenant_status ON tbl_products(tenant_id, status);
END $$;
