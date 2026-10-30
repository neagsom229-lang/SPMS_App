-- Migration 002: Stock log table and POS enhancements
CREATE TABLE IF NOT EXISTS tbl_stock_log (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES tbl_products(id) ON DELETE CASCADE,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    change_qty INTEGER NOT NULL,
    transaction_type VARCHAR(50) NOT NULL, -- SALE, RESTOCK, RETURN, VOID, ADJUSTMENT
    reference_type VARCHAR(50) NOT NULL, -- ORDER, PURCHASE, MANUAL
    reference_id INTEGER,
    user_id INTEGER REFERENCES tbl_users(userid),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tbl_payment (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES tbl_orders(id) ON DELETE CASCADE,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'COMPLETED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ensure tbl_stock exists for any products lacking stock record
INSERT INTO tbl_stock (productid, qtyinstock, qtyavailable, tenant_id)
SELECT p.id, COALESCE(p.stock, 0), COALESCE(p.stock, 0), p.tenant_id
FROM tbl_products p
WHERE NOT EXISTS (
    SELECT 1 FROM tbl_stock s WHERE s.productid = p.id
);
