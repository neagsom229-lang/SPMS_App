-- Migration 004: Round 3 Hardening & Standardisation on tbl_orders_details & order_date
-- Idempotent and non-destructive

-- 1. Ensure order_date exists on tbl_orders and defaults to created_at or NOW()
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tbl_orders' AND column_name = 'order_date'
    ) THEN
        ALTER TABLE tbl_orders ADD COLUMN order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        UPDATE tbl_orders SET order_date = created_at WHERE order_date IS NULL;
    END IF;
END $$;

-- 2. Ensure tbl_orders_details exists and has buy_price, refunded_qty, refunded_amount
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'tbl_orders_details'
    ) THEN
        CREATE TABLE tbl_orders_details (
            id SERIAL PRIMARY KEY,
            order_id INTEGER REFERENCES tbl_orders(or_id) ON DELETE CASCADE,
            product_id INTEGER REFERENCES tbl_products(id) ON DELETE CASCADE,
            qty_order INTEGER NOT NULL DEFAULT 1,
            price NUMERIC(12,2) NOT NULL DEFAULT 0,
            buy_price NUMERIC(12,2) DEFAULT 0,
            discount NUMERIC(12,2) DEFAULT 0,
            subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
            refunded_qty INTEGER DEFAULT 0,
            refunded_amount NUMERIC(12,2) DEFAULT 0,
            tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE
        );
    ELSE
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tbl_orders_details' AND column_name = 'buy_price'
        ) THEN
            ALTER TABLE tbl_orders_details ADD COLUMN buy_price NUMERIC(12,2) DEFAULT 0;
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tbl_orders_details' AND column_name = 'refunded_qty'
        ) THEN
            ALTER TABLE tbl_orders_details ADD COLUMN refunded_qty INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tbl_orders_details' AND column_name = 'refunded_amount'
        ) THEN
            ALTER TABLE tbl_orders_details ADD COLUMN refunded_amount NUMERIC(12,2) DEFAULT 0;
        END IF;
    END IF;
END $$;

-- 3. Ensure tbl_stock has tenant_id and required quantities
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
END $$;

-- 4. Re-create indexes on order_date
CREATE INDEX IF NOT EXISTS idx_orders_tenant_order_date ON tbl_orders(tenant_id, order_date);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status ON tbl_orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_stock_product_id ON tbl_stock(productid);
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tbl_products' AND column_name = 'status') THEN
        CREATE INDEX IF NOT EXISTS idx_products_tenant_status ON tbl_products(tenant_id, status);
    END IF;
END $$;
