CREATE OR REPLACE FUNCTION sync_product_stock() RETURNS trigger AS $$
BEGIN
  UPDATE tbl_products SET stock = NEW.qtyavailable WHERE id = NEW.productid;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_product_stock ON tbl_stock;
CREATE TRIGGER trg_sync_product_stock
AFTER INSERT OR UPDATE OF qtyavailable ON tbl_stock
FOR EACH ROW EXECUTE FUNCTION sync_product_stock();

UPDATE tbl_products p SET stock = s.qtyavailable
FROM tbl_stock s
WHERE s.productid = p.id AND p.stock IS DISTINCT FROM s.qtyavailable;