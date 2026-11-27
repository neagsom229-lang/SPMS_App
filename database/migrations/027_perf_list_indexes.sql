-- 027_perf_list_indexes.sql
--
-- Additive, idempotent. Measured on 50 tenants x 100 products x 400 orders
-- (scratch DB, queried as tenant 1, EXPLAIN ANALYZE BUFFERS, median of 5
-- runs each).
--
--   order detail  SELECT * FROM tbl_order_items WHERE order_id = $1
--                 before 1.158 ms (Seq Scan, 20,000 rows) -> after 0.027 ms
--                 with this index: 43x, so it is kept.
--
--   products list  WHERE tenant_id=$1 ORDER BY id DESC LIMIT 20   1.278 -> 0.044 ms (29x)
--   orders list    WHERE tenant_id=$1 ORDER BY or_id DESC LIMIT 20 3.077 -> 0.071 ms (43x)
--   orders status  WHERE tenant_id=$1 AND status=$2 ORDER BY or_id DESC
--                                0.430 -> 0.114 ms (3.8x)
--
-- Phase 10b merged the previously separate 028 migration into this file (027 was
-- never applied to production); the three tenant-prefixed candidates are now part
-- of the same additive, idempotent file.
--
-- IF NOT EXISTS, so replaying this migration on a database that already has the
-- index is a no-op.

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON public.tbl_order_items USING btree (order_id);

CREATE INDEX IF NOT EXISTS idx_products_tenant_id_id_desc
  ON public.tbl_products USING btree (tenant_id, id DESC);

CREATE INDEX IF NOT EXISTS idx_orders_tenant_id_or_id_desc
  ON public.tbl_orders USING btree (tenant_id, or_id DESC);

CREATE INDEX IF NOT EXISTS idx_orders_tenant_status_or_id_desc
  ON public.tbl_orders USING btree (tenant_id, status, or_id DESC);
