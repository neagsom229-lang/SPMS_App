-- 027_perf_list_indexes.sql
--
-- Additive, idempotent indexes for the list screens measured in Phase 5b
-- (5,000 products / 20,000 orders, spms_perf_test).
--
--   products list   WHERE tenant_id = $1 ORDER BY id DESC LIMIT 20
--   orders list     WHERE tenant_id = $1 ORDER BY or_id DESC LIMIT 20
--   orders status   WHERE tenant_id = $1 AND status = $2 ORDER BY or_id DESC
--   order detail    WHERE order_id = $1
--
-- Every statement is IF NOT EXISTS, so replaying this migration on a database
-- that already has the indexes is a no-op.
CREATE INDEX IF NOT EXISTS idx_products_tenant_id_desc
  ON public.tbl_products USING btree (tenant_id, id DESC);

CREATE INDEX IF NOT EXISTS idx_orders_tenant_or_id_desc
  ON public.tbl_orders USING btree (tenant_id, or_id DESC);

CREATE INDEX IF NOT EXISTS idx_orders_tenant_status_or_id_desc
  ON public.tbl_orders USING btree (tenant_id, status, or_id DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON public.tbl_order_items USING btree (order_id);
