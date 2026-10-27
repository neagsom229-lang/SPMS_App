-- Database Schema for SPMS (Sale & Product Management System)
-- INFERRED FROM APPLICATION QUERIES

CREATE TABLE IF NOT EXISTS tenants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tbl_users (
    userid SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    fullname VARCHAR(255),
    role VARCHAR(50) DEFAULT 'Admin',
    role_name VARCHAR(50),
    status VARCHAR(50) DEFAULT 'ACTIVE',
    is_super_admin BOOLEAN DEFAULT FALSE,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tbl_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tbl_products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    name_kh VARCHAR(255),
    category_id INTEGER REFERENCES tbl_categories(id),
    price DECIMAL(10,2) NOT NULL,
    cost DECIMAL(10,2),
    stock INTEGER DEFAULT 0,
    barcode VARCHAR(100),
    image_url TEXT,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tbl_customers (
    id SERIAL PRIMARY KEY,
    cus_id VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tbl_suppliers (
    id SERIAL PRIMARY KEY,
    sup_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tbl_orders (
    or_id SERIAL PRIMARY KEY,
    order_no VARCHAR(100) NOT NULL,
    customer_id INTEGER REFERENCES tbl_customers(id),
    user_id INTEGER REFERENCES tbl_users(userid),
    total DECIMAL(10,2) NOT NULL,
    discount DECIMAL(10,2) DEFAULT 0,
    payment_method VARCHAR(50),
    status VARCHAR(50) DEFAULT 'Completed',
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tbl_order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES tbl_orders(or_id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES tbl_products(id),
    qty INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tbl_stock (
    id SERIAL PRIMARY KEY,
    productid INTEGER REFERENCES tbl_products(id) ON DELETE CASCADE,
    qtyinstock INTEGER DEFAULT 0,
    qtyavailable INTEGER DEFAULT 0,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tbl_activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES tbl_users(userid),
    action VARCHAR(255) NOT NULL,
    target_table VARCHAR(100),
    target_id INTEGER,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
