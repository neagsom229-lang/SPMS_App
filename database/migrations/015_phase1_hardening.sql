-- Migration 015: Phase 1 Hardening (Tenant constraints & Void tracking)

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT userid, username FROM tbl_users WHERE tenant_id IS NULL AND (is_super_admin = FALSE OR is_super_admin IS NULL) LOOP
        RAISE NOTICE 'Violating user without tenant_id: id=%, username=%', r.userid, r.username;
    END LOOP;
END $$;

-- Add CHECK constraint on tbl_users NOT VALID
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'chk_user_tenant' AND table_name = 'tbl_users'
    ) THEN
        ALTER TABLE tbl_users ADD CONSTRAINT chk_user_tenant 
        CHECK (is_super_admin = TRUE OR tenant_id IS NOT NULL) NOT VALID;
    END IF;
END $$;

-- Add void columns to tbl_orders
ALTER TABLE tbl_orders ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP;
ALTER TABLE tbl_orders ADD COLUMN IF NOT EXISTS voided_by INTEGER;
ALTER TABLE tbl_orders ADD COLUMN IF NOT EXISTS void_reason TEXT;

-- Add CHECK constraint on tbl_payment status
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'chk_payment_status' AND table_name = 'tbl_payment'
    ) THEN
        ALTER TABLE tbl_payment ADD CONSTRAINT chk_payment_status 
        CHECK (status IN ('COMPLETED', 'REFUNDED', 'CANCELLED', 'VOIDED', 'PENDING', 'FAILED')) NOT VALID;
    END IF;
END $$;
