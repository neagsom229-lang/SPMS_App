-- Migration 017: Checkout Hardening (Stock constraints, Tenant-scoped idempotency, Order number sequencing)

-- 1. Deduplicate tbl_stock and add UNIQUE(tenant_id, productid)
DO $$
BEGIN
    -- Remove duplicates keeping the one with max id or max stock
    DELETE FROM tbl_stock a USING tbl_stock b
    WHERE a.id < b.id AND a.tenant_id = b.tenant_id AND a.productid = b.productid;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'uq_tenant_product_stock' AND table_name = 'tbl_stock'
    ) THEN
        ALTER TABLE tbl_stock ADD CONSTRAINT uq_tenant_product_stock UNIQUE (tenant_id, productid);
    END IF;
END $$;

-- 2. Add non-negative stock CHECK constraints
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'chk_stock_non_negative' AND table_name = 'tbl_stock'
    ) THEN
        ALTER TABLE tbl_stock ADD CONSTRAINT chk_stock_non_negative CHECK (qtyavailable >= 0 AND qtyinstock >= 0);
    END IF;
END $$;

-- 3. Tenant-scoped idempotency key constraint on tbl_orders
DO $$
BEGIN
    -- Drop old global unique constraint on idempotency_key if present
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'tbl_orders_idempotency_key_key' OR constraint_name = 'uq_idempotency_key'
    ) THEN
        ALTER TABLE tbl_orders DROP CONSTRAINT IF EXISTS tbl_orders_idempotency_key_key;
        ALTER TABLE tbl_orders DROP CONSTRAINT IF EXISTS uq_idempotency_key;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'uq_tenant_idempotency' AND table_name = 'tbl_orders'
    ) THEN
        ALTER TABLE tbl_orders ADD CONSTRAINT uq_tenant_idempotency UNIQUE (tenant_id, idempotency_key);
    END IF;
END $$;

-- 4. Unique order_no per tenant constraint on tbl_orders
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'uq_tenant_order_no' AND table_name = 'tbl_orders'
    ) THEN
        ALTER TABLE tbl_orders ADD CONSTRAINT uq_tenant_order_no UNIQUE (tenant_id, order_no);
    END IF;
END $$;

-- 5. Tenant sequence counter table for order numbers
CREATE TABLE IF NOT EXISTS tenant_order_counters (
    tenant_id INTEGER PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    last_seq INTEGER DEFAULT 0
);
