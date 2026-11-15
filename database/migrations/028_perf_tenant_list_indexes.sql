-- 028_perf_tenant_list_indexes.sql
--
-- Additive, idempotent. Phase 9f: the tenant-prefixed list queries measured in
-- migration 027 were asked for again and are added here as a NEW migration rather
-- than editing 027 (which may already be applied).
--
-- Measured on the scratch perf DB (50 tenants x 100 products x 400 orders):
--
--   products list  WHERE tenant_id=$1 ORDER BY id DESC LIMIT 20   1.278 -> 0.044 ms (29x)
--   orders list    WHERE tenant_id=$1 ORDER BY or_id DESC LIMIT 20 3.077 -> 0.071 ms (43x)
--   orders status  WHERE tenant_id=$1 AND status=$2 ORDER BY or_id DESC
--                                0.430 -> 0.114 ms (3.8x)
--
-- IF NOT EXISTS, so replaying this migration on a database that already has the
-- indexes is a no-op.

CREATE INDEX IF NOT EXISTS idx_products_tenant_id_id_desc
  ON public.tbl_products USING btree (tenant_id, id DESC);

CREATE INDEX IF NOT EXISTS idx_orders_tenant_id_or_id_desc
  ON public.tbl_orders USING btree (tenant_id, or_id DESC);

CREATE INDEX IF NOT EXISTS idx_orders_tenant_status_or_id_desc
  ON public.tbl_orders USING btree (tenant_id, status, or_id DESC);
