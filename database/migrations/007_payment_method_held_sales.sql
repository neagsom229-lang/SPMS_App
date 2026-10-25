CREATE TABLE IF NOT EXISTS tbl_payment_method (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  name_kh VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tbl_held_sales (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  user_id INTEGER,
  customer_id INTEGER,
  cart_json JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_payment_method_tenant ON tbl_payment_method(tenant_id);
CREATE INDEX IF NOT EXISTS idx_held_sales_tenant ON tbl_held_sales(tenant_id, user_id);
ALTER TABLE tbl_payment_method ENABLE ROW LEVEL SECURITY;
ALTER TABLE tbl_held_sales ENABLE ROW LEVEL SECURITY;
