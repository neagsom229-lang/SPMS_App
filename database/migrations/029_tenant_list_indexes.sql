-- 029_tenant_list_indexes.sql
--
-- Additive, idempotent. The tenant-scoped list queries below still did a
-- sequential scan after the 027 indexes (confirmed with EXPLAIN on the local
-- dev database, which has the seeded demo tenant):
--
--   GET /api/users          WHERE tenant_id=$1 ORDER BY userid
--   GET /api/customers      WHERE tenant_id=$1 AND lower(status)='active' ORDER BY name
--   GET /api/categories     WHERE tenant_id=$1 ORDER BY name
--   GET /api/suppliers      WHERE tenant_id=$1 ORDER BY sup_name
--   GET /api/activity-logs  WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT n
--
-- Each index is tenant-first so it also serves the equality filter. Nothing
-- here changes data or drops an existing object.

CREATE INDEX IF NOT EXISTS idx_users_tenant_userid
  ON public.tbl_users USING btree (tenant_id, userid);

CREATE INDEX IF NOT EXISTS idx_customers_tenant_name
  ON public.tbl_customers USING btree (tenant_id, name);

CREATE INDEX IF NOT EXISTS idx_categories_tenant_name
  ON public.tbl_categories USING btree (tenant_id, name);

CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_name
  ON public.tbl_suppliers USING btree (tenant_id, sup_name);

CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant_created
  ON public.tbl_activity_logs USING btree (tenant_id, created_at DESC);
