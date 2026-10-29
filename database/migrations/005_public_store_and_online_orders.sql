-- Migration 005: Public Store Settings, Online Orders, and Product Extensions
-- Idempotent and non-destructive

-- 1. Create store_settings table
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
    opening_hours JSONB DEFAULT '{}'::jsonb,
    tax_rate NUMERIC(5,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_store_settings_slug ON store_settings(slug);
CREATE INDEX IF NOT EXISTS idx_store_settings_tenant ON store_settings(tenant_id);

-- 2. Extend tbl_orders for online ordering
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tbl_orders' AND column_name = 'source'
    ) THEN
        ALTER TABLE tbl_orders ADD COLUMN source VARCHAR(20) DEFAULT 'POS';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tbl_orders' AND column_name = 'customer_name'
    ) THEN
        ALTER TABLE tbl_orders ADD COLUMN customer_name VARCHAR(255);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tbl_orders' AND column_name = 'customer_phone'
    ) THEN
        ALTER TABLE tbl_orders ADD COLUMN customer_phone VARCHAR(50);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tbl_orders' AND column_name = 'delivery_type'
    ) THEN
        ALTER TABLE tbl_orders ADD COLUMN delivery_type VARCHAR(20) DEFAULT 'pickup'; -- pickup | delivery
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tbl_orders' AND column_name = 'delivery_address'
    ) THEN
        ALTER TABLE tbl_orders ADD COLUMN delivery_address TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tbl_orders' AND column_name = 'notes'
    ) THEN
        ALTER TABLE tbl_orders ADD COLUMN notes TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tbl_orders' AND column_name = 'tracking_code'
    ) THEN
        ALTER TABLE tbl_orders ADD COLUMN tracking_code VARCHAR(100) UNIQUE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tbl_orders' AND column_name = 'idempotency_key'
    ) THEN
        ALTER TABLE tbl_orders ADD COLUMN idempotency_key VARCHAR(255) UNIQUE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_tracking_code ON tbl_orders(tracking_code);
CREATE INDEX IF NOT EXISTS idx_orders_idempotency ON tbl_orders(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_orders_source ON tbl_orders(tenant_id, source);

-- 3. Extend tbl_products with public storefront fields
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tbl_products' AND column_name = 'is_published'
    ) THEN
        ALTER TABLE tbl_products ADD COLUMN is_published BOOLEAN DEFAULT true;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tbl_products' AND column_name = 'sort_order'
    ) THEN
        ALTER TABLE tbl_products ADD COLUMN sort_order INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tbl_products' AND column_name = 'description_en'
    ) THEN
        ALTER TABLE tbl_products ADD COLUMN description_en TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tbl_products' AND column_name = 'description_kh'
    ) THEN
        ALTER TABLE tbl_products ADD COLUMN description_kh TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tbl_products' AND column_name = 'image_url'
    ) THEN
        ALTER TABLE tbl_products ADD COLUMN image_url TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tbl_products' AND column_name = 'is_published')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tbl_products' AND column_name = 'status') THEN
        CREATE INDEX IF NOT EXISTS idx_products_tenant_published ON tbl_products(tenant_id, is_published, status);
    END IF;
END $$;
