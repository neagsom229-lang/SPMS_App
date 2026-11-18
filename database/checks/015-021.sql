-- STEP A (read-only): ledger reconciliation existence checks, migrations 015..021
SELECT '015_phase1_hardening' AS migration, 'chk_user_tenant (tbl_users)' AS object,
  EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'chk_user_tenant' AND table_name = 'tbl_users') AS exists;
SELECT '015_phase1_hardening' AS migration, 'chk_payment_status (tbl_payment)' AS object,
  EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'chk_payment_status' AND table_name = 'tbl_payment') AS exists;
SELECT '015_phase1_hardening' AS migration, 'tbl_orders.voided_at' AS object,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tbl_orders' AND column_name = 'voided_at') AS exists;
SELECT '015_phase1_hardening' AS migration, 'tbl_orders.voided_by' AS object,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tbl_orders' AND column_name = 'voided_by') AS exists;
SELECT '015_phase1_hardening' AS migration, 'tbl_orders.void_reason' AS object,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tbl_orders' AND column_name = 'void_reason') AS exists;
SELECT '016_must_change_password' AS migration, 'tbl_users.must_change_password' AS object,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tbl_users' AND column_name = 'must_change_password') AS exists;
SELECT '017_checkout_hardening' AS migration, 'tbl_stock.uq_tenant_product_stock' AS object,
  EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'uq_tenant_product_stock' AND table_name = 'tbl_stock') AS exists;
SELECT '017_checkout_hardening' AS migration, 'tbl_stock.chk_stock_non_negative' AS object,
  EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'chk_stock_non_negative' AND table_name = 'tbl_stock') AS exists;
SELECT '017_checkout_hardening' AS migration, 'tbl_orders.uq_tenant_idempotency' AS object,
  EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'uq_tenant_idempotency' AND table_name = 'tbl_orders') AS exists;
SELECT '017_checkout_hardening' AS migration, 'tbl_orders.uq_tenant_order_no' AS object,
  EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'uq_tenant_order_no' AND table_name = 'tbl_orders') AS exists;
SELECT '017_checkout_hardening' AS migration, 'tenant_order_counters' AS object,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenant_order_counters') AS exists;
SELECT '018_refunds_and_payments' AS migration, 'tbl_order_items.refunded_amount' AS object,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tbl_order_items' AND column_name = 'refunded_amount') AS exists;
SELECT '018_refunds_and_payments' AS migration, 'khqr_sessions' AS object,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'khqr_sessions') AS exists;
SELECT '018_refunds_and_payments' AS migration, 'idx_khqr_sessions_tenant' AS object,
  EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_khqr_sessions_tenant') AS exists;
SELECT '018_refunds_and_payments' AS migration, 'idx_khqr_sessions_expiry' AS object,
  EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_khqr_sessions_expiry') AS exists;
SELECT '019_revert_and_align' AS migration, 'tbl_stock_log.type' AS object,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tbl_stock_log' AND column_name = 'type') AS exists;
SELECT '019_revert_and_align' AS migration, 'tbl_stock_log.transaction_type' AS object,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tbl_stock_log' AND column_name = 'transaction_type') AS exists;
SELECT '019_revert_and_align' AS migration, 'tbl_stock_log.reference_type' AS object,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tbl_stock_log' AND column_name = 'reference_type') AS exists;
SELECT '019_revert_and_align' AS migration, 'tbl_stock_log.user_id' AS object,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tbl_stock_log' AND column_name = 'user_id') AS exists;
SELECT '019_revert_and_align' AS migration, 'tbl_stock_log.notes' AS object,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tbl_stock_log' AND column_name = 'notes') AS exists;
SELECT '019_revert_and_align' AS migration, 'idx_products_tenant_status' AS object,
  EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_products_tenant_status') AS exists;
SELECT '020_reconcile_production' AS migration, 'store_settings.opening_hours' AS object,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'store_settings' AND column_name = 'opening_hours') AS exists;
SELECT '021_token_version' AS migration, 'tbl_users.token_version' AS object,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tbl_users' AND column_name = 'token_version') AS exists;
