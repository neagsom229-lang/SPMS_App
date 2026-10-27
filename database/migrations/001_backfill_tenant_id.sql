-- Migration 001: Backfill Tenant ID
-- Do not run automatically against production.

-- 1. Count rows with NULL tenant_id per table
SELECT 'tbl_customers' AS table_name, COUNT(*) AS null_count FROM tbl_customers WHERE tenant_id IS NULL
UNION ALL
SELECT 'tbl_products', COUNT(*) FROM tbl_products WHERE tenant_id IS NULL
UNION ALL
SELECT 'tbl_orders', COUNT(*) FROM tbl_orders WHERE tenant_id IS NULL
UNION ALL
SELECT 'tbl_suppliers', COUNT(*) FROM tbl_suppliers WHERE tenant_id IS NULL
UNION ALL
SELECT 'tbl_users', COUNT(*) FROM tbl_users WHERE tenant_id IS NULL;

-- 2. Commented UPDATE templates for backfilling tenant_id
/*
UPDATE tbl_customers SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE tbl_products SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE tbl_orders SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE tbl_suppliers SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE tbl_users SET tenant_id = 1 WHERE tenant_id IS NULL AND is_super_admin = FALSE;
*/
