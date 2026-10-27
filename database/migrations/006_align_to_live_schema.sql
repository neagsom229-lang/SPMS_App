-- Migration 006: Align to Live Schema (Additive & Idempotent)
-- Adds missing feature columns and tables without dropping or renaming existing ones.

-- 1. Extend tbl_products with missing feature columns if absent
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tbl_products' AND column_name = 'status') THEN
        ALTER TABLE tbl_products ADD COLUMN status VARCHAR(50) DEFAULT 'Active';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tbl_products' AND column_name = 'qty_alert') THEN
        ALTER TABLE tbl_products ADD COLUMN qty_alert INTEGER DEFAULT 5;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tbl_products' AND column_name = 'is_published') THEN
        ALTER TABLE tbl_products ADD COLUMN is_published BOOLEAN DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tbl_products' AND column_name = 'sort_order') THEN
        ALTER TABLE tbl_products ADD COLUMN sort_order INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tbl_products' AND column_name = 'description_en') THEN
        ALTER TABLE tbl_products ADD COLUMN description_en TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tbl_products' AND column_name = 'description_kh') THEN
        ALTER TABLE tbl_products ADD COLUMN description_kh TEXT;
    END IF;
END $$;

-- 2. Extend tbl_order_items with missing columns if absent
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tbl_order_items' AND column_name = 'buy_price') THEN
        ALTER TABLE tbl_order_items ADD COLUMN buy_price DECIMAL(10,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tbl_order_items' AND column_name = 'refunded_qty') THEN
        ALTER TABLE tbl_order_items ADD COLUMN refunded_qty INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tbl_order_items' AND column_name = 'refunded_amount') THEN
        ALTER TABLE tbl_order_items ADD COLUMN refunded_amount DECIMAL(10,2) DEFAULT 0;
    END IF;
END $$;

-- 3. Extend tbl_orders with missing columns if absent
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tbl_orders' AND column_name = 'source') THEN
        ALTER TABLE tbl_orders ADD COLUMN source VARCHAR(20) DEFAULT 'POS';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tbl_orders' AND column_name = 'tracking_code') THEN
        ALTER TABLE tbl_orders ADD COLUMN tracking_code VARCHAR(100) UNIQUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tbl_orders' AND column_name = 'idempotency_key') THEN
        ALTER TABLE tbl_orders ADD COLUMN idempotency_key VARCHAR(255) UNIQUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tbl_orders' AND column_name = 'customer_name') THEN
        ALTER TABLE tbl_orders ADD COLUMN customer_name VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tbl_orders' AND column_name = 'customer_phone') THEN
        ALTER TABLE tbl_orders ADD COLUMN customer_phone VARCHAR(50);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tbl_orders' AND column_name = 'delivery_type') THEN
        ALTER TABLE tbl_orders ADD COLUMN delivery_type VARCHAR(20) DEFAULT 'pickup';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tbl_orders' AND column_name = 'delivery_address') THEN
        ALTER TABLE tbl_orders ADD COLUMN delivery_address TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tbl_orders' AND column_name = 'notes') THEN
        ALTER TABLE tbl_orders ADD COLUMN notes TEXT;
    END IF;
END $$;

-- 4. Create auxiliary tables if absent
CREATE TABLE IF NOT EXISTS tbl_stock_log (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES tbl_products(id) ON DELETE CASCADE,
    change_qty INTEGER NOT NULL,
    type VARCHAR(50),
    transaction_type VARCHAR(50),
    reference_type VARCHAR(50),
    reference_id INTEGER,
    user_id INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE tbl_stock_log ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE tbl_stock_log ADD COLUMN IF NOT EXISTS type VARCHAR(50);
ALTER TABLE tbl_stock_log ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(50);
ALTER TABLE tbl_stock_log ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50) DEFAULT 'ORDER';
ALTER TABLE tbl_stock_log ALTER COLUMN reference_type DROP NOT NULL;
ALTER TABLE tbl_stock_log ADD COLUMN IF NOT EXISTS user_id INTEGER;

CREATE TABLE IF NOT EXISTS store_settings (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    slug VARCHAR(100) UNIQUE NOT NULL,
    store_name VARCHAR(255) NOT NULL,
    logo_url TEXT,
    phone VARCHAR(50),
    address TEXT,
    currency VARCHAR(10) DEFAULT 'USD',
    exchange_rate NUMERIC(10,4) DEFAULT 4000.0000,
    is_open BOOLEAN DEFAULT true,
    accepts_online_orders BOOLEAN DEFAULT true,
    delivery_enabled BOOLEAN DEFAULT true,
    pickup_enabled BOOLEAN DEFAULT true,
    tax_rate NUMERIC(5,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status ON tbl_orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_created ON tbl_orders(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_stock_productid ON tbl_stock(productid);
CREATE INDEX IF NOT EXISTS idx_store_settings_slug ON store_settings(slug);
