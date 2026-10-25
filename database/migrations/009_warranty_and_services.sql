-- Migration 009: Warranty and Service Requests tables (additive)

CREATE TABLE IF NOT EXISTS tbl_warranty (
    warrantyid SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    customerid INTEGER REFERENCES tbl_customers(id) ON DELETE SET NULL,
    productid INTEGER REFERENCES tbl_products(id) ON DELETE SET NULL,
    serialnumber VARCHAR(100),
    warrantyperiod INTEGER DEFAULT 12,
    warrantystartdate DATE,
    warrantyenddate DATE,
    status VARCHAR(50) DEFAULT 'Active',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tbl_service_requests (
    serviceid SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    customerid INTEGER REFERENCES tbl_customers(id) ON DELETE SET NULL,
    productid INTEGER REFERENCES tbl_products(id) ON DELETE SET NULL,
    serialnumber VARCHAR(100),
    issuedescription TEXT,
    servicetype VARCHAR(50) DEFAULT 'Repair',
    status VARCHAR(50) DEFAULT 'Pending',
    receiveddate DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_warranty_tenant ON tbl_warranty(tenant_id);
CREATE INDEX IF NOT EXISTS idx_warranty_customer ON tbl_warranty(customerid);
CREATE INDEX IF NOT EXISTS idx_warranty_product ON tbl_warranty(productid);

CREATE INDEX IF NOT EXISTS idx_services_tenant ON tbl_service_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_services_customer ON tbl_service_requests(customerid);
CREATE INDEX IF NOT EXISTS idx_services_product ON tbl_service_requests(productid);

-- Enable RLS (Row Level Security) if applicable
ALTER TABLE tbl_warranty ENABLE ROW LEVEL SECURITY;
ALTER TABLE tbl_service_requests ENABLE ROW LEVEL SECURITY;
