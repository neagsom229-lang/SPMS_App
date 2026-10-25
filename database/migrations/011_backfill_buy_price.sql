-- Migration 011: Backfill NULL or zero buy_price in tbl_order_items from tbl_products.cost
UPDATE tbl_order_items i
SET buy_price = p.cost
FROM tbl_products p
WHERE i.product_id = p.id
  AND (i.buy_price IS NULL OR i.buy_price = 0)
  AND p.cost IS NOT NULL AND p.cost > 0;
