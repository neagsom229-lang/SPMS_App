#!/bin/bash

# ============================================
# FIX ALL BACKEND ROUTES WITH TENANT FILTER
# ============================================

echo "🔧 Fixing ALL routes with tenant_id filter..."

# Navigate to backend routes
cd backend/src/routes

# ============================================
# 1. PRODUCTS ROUTE
# ============================================
cat > products.js << 'EOF'
// backend/src/routes/products.js
const express = require('express');
const pool = require('../config/postgres');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ===== HELPER: Get tenant ID =====
const getTenantId = (req) => {
  return req.user?.tenantId || req.tenantId || req.headers['x-tenant-id'];
};

// ===== GET ALL PRODUCTS (Only current tenant) =====
router.get('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;
  const { page = 1, limit = 20, search, category, status } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let query = `
      SELECT p.*, c.category_en, c.category_kh,
             s.name_en as supplier_name
      FROM tbl_products p
      LEFT JOIN tbl_categories c ON c.id = p.category_id AND c.tenant_id = p.tenant_id
      LEFT JOIN tbl_suppliers s ON s.id = p.supplier_id AND s.tenant_id = p.tenant_id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    // ✅ CRITICAL: Filter by tenant
    if (!isSuperAdmin && tenantId) {
      query += ` AND p.tenant_id = $${paramIndex}`;
      params.push(tenantId);
      paramIndex++;
    }

    if (search) {
      query += ` AND (p.name_en ILIKE $${paramIndex} OR p.name_kh ILIKE $${paramIndex} OR p.barcode ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (category) {
      query += ` AND p.category_id = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (status) {
      query += ` AND p.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    const countQuery = query.replace(
      /SELECT p\.\*, c\.category_en, c\.category_kh, s\.name_en as supplier_name FROM/i,
      'SELECT COUNT(*) as total FROM'
    );
    const countResult = await pool.query(countQuery, params.slice(0, paramIndex - 1));
    const total = parseInt(countResult.rows[0]?.total || 0);

    query += ` ORDER BY p.id DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);

    res.json({
      products: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ Get products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// ===== GET PRODUCT BY ID =====
router.get('/:id', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;

  try {
    let query = `
      SELECT p.*, c.category_en, c.category_kh, s.name_en as supplier_name
      FROM tbl_products p
      LEFT JOIN tbl_categories c ON c.id = p.category_id AND c.tenant_id = p.tenant_id
      LEFT JOIN tbl_suppliers s ON s.id = p.supplier_id AND s.tenant_id = p.tenant_id
      WHERE p.id = $1
    `;
    const params = [req.params.id];

    if (!isSuperAdmin && tenantId) {
      query += ` AND p.tenant_id = $2`;
      params.push(tenantId);
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Get product error:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// ===== CREATE PRODUCT =====
router.post('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  
  if (!tenantId) {
    return res.status(403).json({ error: 'Tenant context required' });
  }

  const userId = req.user?.userId;
  const {
    product_id, supplier_id, barcode, name_en, name_kh, brand, model,
    category_id, buyin_price, saleout_price, qty_instock, qty_alert, status
  } = req.body;

  if (!name_en || saleout_price === undefined) {
    return res.status(400).json({ error: 'Name and sale price are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO tbl_products 
       (tenant_id, product_id, supplier_id, barcode, name_en, name_kh, brand, model,
        category_id, buyin_price, saleout_price, qty_instock, qty_alert, status, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
       RETURNING *`,
      [
        tenantId,
        product_id || null,
        supplier_id || null,
        barcode || null,
        name_en,
        name_kh || null,
        brand || null,
        model || null,
        category_id || null,
        parseFloat(buyin_price) || 0,
        parseFloat(saleout_price) || 0,
        parseInt(qty_instock) || 0,
        parseInt(qty_alert) || 0,
        status || 'ACTIVE',
        userId || null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Create product error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// ===== UPDATE PRODUCT =====
router.put('/:id', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;
  const userId = req.user?.userId;

  try {
    let checkQuery = 'SELECT * FROM tbl_products WHERE id = $1';
    const checkParams = [req.params.id];

    if (!isSuperAdmin && tenantId) {
      checkQuery += ' AND tenant_id = $2';
      checkParams.push(tenantId);
    }

    const existing = await pool.query(checkQuery, checkParams);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const fields = [
      'product_id', 'supplier_id', 'barcode', 'name_en', 'name_kh', 'brand',
      'model', 'category_id', 'buyin_price', 'saleout_price',
      'qty_instock', 'qty_alert', 'status'
    ];

    const updates = [];
    const values = [];
    let paramIndex = 1;

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(req.body[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push(`updated_by = $${paramIndex}`);
    values.push(userId || null);
    paramIndex++;

    updates.push(`updated_at = NOW()`);
    values.push(req.params.id);
    values.push(tenantId);

    const query = `
      UPDATE tbl_products 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
      RETURNING *
    `;

    const result = await pool.query(query, [...values, req.params.id, tenantId]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Update product error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// ===== DELETE PRODUCT =====
router.delete('/:id', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;

  try {
    let query = 'DELETE FROM tbl_products WHERE id = $1';
    const params = [req.params.id];

    if (!isSuperAdmin && tenantId) {
      query += ' AND tenant_id = $2';
      params.push(tenantId);
    }

    const result = await pool.query(query, params);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.status(204).end();
  } catch (error) {
    console.error('❌ Delete product error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = router;
EOF

echo "✅ Products route fixed"

# ============================================
# 2. ORDERS ROUTE
# ============================================
cat > orders.js << 'EOF'
// backend/src/routes/orders.js
const express = require('express');
const pool = require('../config/postgres');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const getTenantId = (req) => {
  return req.user?.tenantId || req.tenantId || req.headers['x-tenant-id'];
};

// ===== GET ALL ORDERS =====
router.get('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;
  const { page = 1, limit = 20, status } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let query = `
      SELECT o.*, c.name_en as customer_name, u.fullname as created_by_name
      FROM tbl_orders o
      LEFT JOIN tbl_customers c ON c.id = o.customer_id AND c.tenant_id = o.tenant_id
      LEFT JOIN tbl_users u ON u.userid = o.created_by
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (!isSuperAdmin && tenantId) {
      query += ` AND o.tenant_id = $${paramIndex}`;
      params.push(tenantId);
      paramIndex++;
    }

    if (status) {
      query += ` AND o.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    const countQuery = query.replace(
      /SELECT o\.\*, c\.name_en as customer_name, u\.fullname as created_by_name FROM/i,
      'SELECT COUNT(*) as total FROM'
    );
    const countResult = await pool.query(countQuery, params.slice(0, paramIndex - 1));
    const total = parseInt(countResult.rows[0]?.total || 0);

    query += ` ORDER BY o.id DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);

    res.json({
      orders: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ Get orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// ===== RECENT ORDERS =====
router.get('/recent', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;
  const { limit = 5 } = req.query;

  try {
    let query = `
      SELECT o.*, c.name_en as customer_name
      FROM tbl_orders o
      LEFT JOIN tbl_customers c ON c.id = o.customer_id
      WHERE 1=1
    `;
    const params = [];

    if (!isSuperAdmin && tenantId) {
      query += ` AND o.tenant_id = $1`;
      params.push(tenantId);
    }

    query += ` ORDER BY o.created_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Get recent orders error:', error);
    res.status(500).json({ error: 'Failed to fetch recent orders' });
  }
});

// ===== PENDING ORDERS =====
router.get('/pending', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;

  try {
    let query = `
      SELECT o.*, c.name_en as customer_name
      FROM tbl_orders o
      LEFT JOIN tbl_customers c ON c.id = o.customer_id
      WHERE o.status = 'Pending'
    `;
    const params = [];

    if (!isSuperAdmin && tenantId) {
      query += ` AND o.tenant_id = $1`;
      params.push(tenantId);
    }

    query += ' ORDER BY o.created_at DESC LIMIT 10';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Get pending orders error:', error);
    res.status(500).json({ error: 'Failed to fetch pending orders' });
  }
});

// ===== CREATE ORDER =====
router.post('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  
  if (!tenantId) {
    return res.status(403).json({ error: 'Tenant context required' });
  }

  const userId = req.user?.userId;
  const { customer_id, items, total_amount, payment_method, notes } = req.body;

  if (!customer_id || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Customer and items are required' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const orderResult = await client.query(
      `INSERT INTO tbl_orders 
       (tenant_id, customer_id, total_amount, status, payment_method, notes, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [tenantId, customer_id, total_amount || 0, 'PENDING', payment_method || 'CASH', notes || null, userId]
    );

    const order = orderResult.rows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO order_items 
         (tenant_id, order_id, product_id, quantity, price, total)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tenantId, order.id, item.product_id, item.quantity, item.price, item.quantity * item.price]
      );

      await client.query(
        `UPDATE tbl_products 
         SET qty_instock = qty_instock - $1,
             updated_at = NOW()
         WHERE id = $2 AND tenant_id = $3`,
        [item.quantity, item.product_id, tenantId]
      );
    }

    await client.query('COMMIT');

    res.status(201).json(order);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  } finally {
    client.release();
  }
});

module.exports = router;
EOF

echo "✅ Orders route fixed"

# ============================================
# 3. CUSTOMERS ROUTE
# ============================================
cat > customers.js << 'EOF'
// backend/src/routes/customers.js
const express = require('express');
const pool = require('../config/postgres');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const getTenantId = (req) => {
  return req.user?.tenantId || req.tenantId || req.headers['x-tenant-id'];
};

router.get('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;
  const { search } = req.query;

  try {
    let sql = "SELECT * FROM tbl_customers WHERE status = 'Active'";
    const params = [];

    if (!isSuperAdmin && tenantId) {
      sql += " AND tenant_id = $1";
      params.push(tenantId);
    }

    if (search) {
      const paramIndex = params.length + 1;
      sql += ` AND (first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex} OR phone ILIKE $${paramIndex} OR e_mail ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
    }

    sql += " ORDER BY first_name ASC";

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Customers error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  
  if (!tenantId) {
    return res.status(403).json({ error: 'Tenant context required' });
  }

  const { FIRST_NAME, LAST_NAME, PHONE, E_MAIL, ADDRESS, BALANCE } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO tbl_customers 
       (tenant_id, cus_id, first_name, last_name, phone, e_mail, address, balance, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Active', NOW())
       RETURNING *`,
      [
        tenantId,
        `CUS${String(Date.now()).slice(-6)}`,
        FIRST_NAME,
        LAST_NAME,
        PHONE || null,
        E_MAIL || null,
        ADDRESS || null,
        BALANCE || 0
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Create customer error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
EOF

echo "✅ Customers route fixed"

# ============================================
# 4. SUPPLIERS ROUTE
# ============================================
cat > suppliers.js << 'EOF'
// backend/src/routes/suppliers.js
const express = require('express');
const pool = require('../config/postgres');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const getTenantId = (req) => {
  return req.user?.tenantId || req.tenantId || req.headers['x-tenant-id'];
};

router.get('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;
  const { search } = req.query;

  try {
    let sql = "SELECT * FROM tbl_suppliers WHERE status = 'Active'";
    const params = [];

    if (!isSuperAdmin && tenantId) {
      sql += " AND tenant_id = $1";
      params.push(tenantId);
    }

    if (search) {
      const paramIndex = params.length + 1;
      sql += ` AND (company ILIKE $${paramIndex} OR first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex} OR phone ILIKE $${paramIndex} OR e_mail ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
    }

    sql += " ORDER BY company";

    const result = await pool.query(sql, params);
    const suppliers = result.rows.map((row) => ({
      SUP_ID: row.sup_id,
      SUP_NAME: row.company,
      CONTACT_PERSON: [row.first_name, row.last_name].filter(Boolean).join(' '),
      PHONE: row.phone,
      EMAIL: row.e_mail,
      ADDRESS: row.address,
      STATUS: row.status,
      WEBSITE: row.website,
      TAX_ID: row.tax_id,
      NOTES: row.notes,
    }));
    
    res.json(suppliers);
  } catch (err) {
    console.error("❌ Suppliers error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  
  if (!tenantId) {
    return res.status(403).json({ error: 'Tenant context required' });
  }

  const { SUP_NAME, CONTACT_PERSON, PHONE, EMAIL, ADDRESS, WEBSITE, STATUS, TAX_ID, NOTES } = req.body;

  if (!SUP_NAME || SUP_NAME.trim() === '') {
    return res.status(400).json({ error: 'Supplier name is required' });
  }

  let firstName = '', lastName = '';
  if (CONTACT_PERSON) {
    const parts = CONTACT_PERSON.trim().split(' ');
    if (parts.length > 1) {
      firstName = parts[0];
      lastName = parts.slice(1).join(' ');
    } else {
      firstName = parts[0];
    }
  }

  try {
    const result = await pool.query(
      `INSERT INTO tbl_suppliers 
       (tenant_id, sup_id, company, first_name, last_name, phone, e_mail, address, status, website, tax_id, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
       RETURNING sup_id`,
      [
        tenantId,
        `SUP${String(Date.now()).slice(-6)}`,
        SUP_NAME.trim(),
        firstName || null,
        lastName || null,
        PHONE || null,
        EMAIL || null,
        ADDRESS || null,
        STATUS || 'Active',
        WEBSITE || null,
        TAX_ID || null,
        NOTES || null,
      ]
    );

    res.status(201).json({
      SUP_ID: result.rows[0].sup_id,
      message: 'Supplier created successfully',
    });
  } catch (err) {
    console.error("❌ Create supplier error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/bulk', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No supplier IDs provided' });
  }

  try {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const query = `
      DELETE FROM tbl_suppliers 
      WHERE sup_id IN (${placeholders}) AND tenant_id = $${ids.length + 1}
    `;
    const result = await pool.query(query, [...ids, tenantId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Suppliers not found' });
    }

    res.json({
      message: `${result.rowCount} suppliers deleted successfully`,
      deleted: result.rowCount,
    });
  } catch (err) {
    console.error("❌ Bulk delete error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
EOF

echo "✅ Suppliers route fixed"

# ============================================
# 5. STOCK ROUTE
# ============================================
cat > stock.js << 'EOF'
// backend/src/routes/stock.js
const express = require('express');
const pool = require('../config/postgres');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const getTenantId = (req) => {
  return req.user?.tenantId || req.tenantId || req.headers['x-tenant-id'];
};

router.get('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;

  try {
    let query = `
      SELECT s.*, p.product_id as product_code, p.name_en, p.name_kh, p.qty_alert, p.saleout_price
      FROM tbl_stock s
      LEFT JOIN tbl_products p ON s.productid = p.id
      WHERE 1=1
    `;
    const params = [];

    if (!isSuperAdmin && tenantId) {
      query += ` AND p.tenant_id = $1`;
      params.push(tenantId);
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Stock error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/low-stock', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;

  try {
    let query = `
      SELECT p.product_id, p.name_en, p.name_kh, s.qtyavailable, p.qty_alert, p.saleout_price
      FROM tbl_stock s
      LEFT JOIN tbl_products p ON s.productid = p.id
      WHERE s.qtyavailable <= p.qty_alert AND p.status = 'Active'
    `;
    const params = [];

    if (!isSuperAdmin && tenantId) {
      query += ` AND p.tenant_id = $1`;
      params.push(tenantId);
    }

    query += ` ORDER BY s.qtyavailable ASC`;

    const result = await pool.query(query, params);
    res.json(result.rows || []);
  } catch (err) {
    console.error('❌ Low stock error:', err.message);
    res.status(500).json([]);
  }
});

module.exports = router;
EOF

echo "✅ Stock route fixed"

# ============================================
# 6. USERS ROUTE
# ============================================
cat > users.js << 'EOF'
// backend/src/routes/users.js
const express = require('express');
const pool = require('../config/postgres');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

const getTenantId = (req) => {
  return req.user?.tenantId || req.tenantId || req.headers['x-tenant-id'];
};

router.get('/', authenticate, authorize('Admin'), async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;

  try {
    let sql = `
      SELECT userid, username, fullname, role, status, createdat, email, phone, is_super_admin 
      FROM tbl_users
      WHERE 1=1
    `;
    const params = [];

    if (!isSuperAdmin && tenantId) {
      sql += ` AND tenant_id = $1`;
      params.push(tenantId);
    }

    sql += ` ORDER BY userid`;

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Users error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
EOF

echo "✅ Users route fixed"

# ============================================
# 7. WARRANTY ROUTE
# ============================================
cat > warranties.js << 'EOF'
// backend/src/routes/warranties.js
const express = require('express');
const pool = require('../config/postgres');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const getTenantId = (req) => {
  return req.user?.tenantId || req.tenantId || req.headers['x-tenant-id'];
};

router.get('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;

  try {
    let query = `
      SELECT w.*, 
             CONCAT(c.first_name, ' ', c.last_name) as customer_name,
             p.name_en as product_name
      FROM tbl_warranty w
      LEFT JOIN tbl_customers c ON c.id = w.customerid AND c.tenant_id = w.tenant_id
      LEFT JOIN tbl_products p ON p.id = w.productid AND p.tenant_id = w.tenant_id
      WHERE 1=1
    `;
    const params = [];

    if (!isSuperAdmin && tenantId) {
      query += ` AND w.tenant_id = $1`;
      params.push(tenantId);
    }

    query += ` ORDER BY w.warrantyid DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Warranties error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===== DELETE WARRANTY =====
router.delete('/:id', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;

  try {
    let query = 'DELETE FROM tbl_warranty WHERE id = $1';
    const params = [req.params.id];

    if (!isSuperAdmin && tenantId) {
      query += ' AND tenant_id = $2';
      params.push(tenantId);
    }

    const result = await pool.query(query, params);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Warranty not found' });
    }

    res.status(204).end();
  } catch (error) {
    console.error('❌ Delete warranty error:', error);
    res.status(500).json({ error: 'Failed to delete warranty' });
  }
});

module.exports = router;
EOF

echo "✅ Warranties route fixed"

# ============================================
# 8. SERVICES ROUTE
# ============================================
cat > services.js << 'EOF'
// backend/src/routes/services.js
const express = require('express');
const pool = require('../config/postgres');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const getTenantId = (req) => {
  return req.user?.tenantId || req.tenantId || req.headers['x-tenant-id'];
};

router.get('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;

  try {
    let query = `
      SELECT s.*, 
             CONCAT(c.first_name, ' ', c.last_name) as customer_name,
             p.name_en as product_name
      FROM tbl_service_requests s
      LEFT JOIN tbl_customers c ON c.id = s.customerid AND c.tenant_id = s.tenant_id
      LEFT JOIN tbl_products p ON p.id = s.productid AND p.tenant_id = s.tenant_id
      WHERE 1=1
    `;
    const params = [];

    if (!isSuperAdmin && tenantId) {
      query += ` AND s.tenant_id = $1`;
      params.push(tenantId);
    }

    query += ` ORDER BY s.serviceid DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Services error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===== DELETE SERVICE =====
router.delete('/:id', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;

  try {
    let query = 'DELETE FROM tbl_service_requests WHERE id = $1';
    const params = [req.params.id];

    if (!isSuperAdmin && tenantId) {
      query += ' AND tenant_id = $2';
      params.push(tenantId);
    }

    const result = await pool.query(query, params);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }

    res.status(204).end();
  } catch (error) {
    console.error('❌ Delete service error:', error);
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

module.exports = router;
EOF

echo "✅ Services route fixed"

# ============================================
# 9. ACTIVITY LOGS ROUTE
# ============================================
cat > activity-logs.js << 'EOF'
// backend/src/routes/activity-logs.js
const express = require('express');
const pool = require('../config/postgres');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const getTenantId = (req) => {
  return req.user?.tenantId || req.tenantId || req.headers['x-tenant-id'];
};

router.get('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;
  const { limit = 200, search, action, table_name, user_id } = req.query;

  try {
    let query = `
      SELECT al.*, u.username 
      FROM tbl_activity_logs al
      LEFT JOIN tbl_users u ON u.userid = al.user_id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (!isSuperAdmin && tenantId) {
      query += ` AND al.tenant_id = $${paramIndex}`;
      params.push(tenantId);
      paramIndex++;
    }

    if (search) {
      query += ` AND (u.username ILIKE $${paramIndex} OR al.action ILIKE $${paramIndex} OR al.table_name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (action) {
      query += ` AND al.action = $${paramIndex}`;
      params.push(action);
      paramIndex++;
    }

    if (table_name) {
      query += ` AND al.table_name = $${paramIndex}`;
      params.push(table_name);
      paramIndex++;
    }

    if (user_id) {
      query += ` AND al.user_id = $${paramIndex}`;
      params.push(user_id);
      paramIndex++;
    }

    query += ` ORDER BY al.action_date DESC LIMIT $${paramIndex}`;
    params.push(Number(limit));

    const result = await pool.query(query, params);

    // Get stats
    let statsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT al.user_id) as unique_users,
        COUNT(DISTINCT al.action) as unique_actions,
        COUNT(DISTINCT al.table_name) as unique_tables
      FROM tbl_activity_logs al
      WHERE 1=1
    `;
    const statsParams = [];

    if (!isSuperAdmin && tenantId) {
      statsQuery += ` AND al.tenant_id = $1`;
      statsParams.push(tenantId);
    }

    const statsResult = await pool.query(statsQuery, statsParams);

    res.json({
      logs: result.rows,
      stats: {
        total: parseInt(statsResult.rows[0]?.total || 0),
        uniqueUsers: parseInt(statsResult.rows[0]?.unique_users || 0),
        uniqueActions: parseInt(statsResult.rows[0]?.unique_actions || 0),
        uniqueTables: parseInt(statsResult.rows[0]?.unique_tables || 0),
      }
    });
  } catch (err) {
    console.error('❌ Activity logs error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
EOF

echo "✅ Activity logs route fixed"

# ============================================
# 10. DASHBOARD ROUTE
# ============================================
cat > dashboard.js << 'EOF'
// backend/src/routes/dashboard.js
const express = require('express');
const pool = require('../config/postgres');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const getTenantId = (req) => {
  return req.user?.tenantId || req.tenantId || req.headers['x-tenant-id'];
};

// ===== DASHBOARD STATS =====
router.get('/stats', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;

  try {
    let productQuery = 'SELECT COUNT(*) as count FROM tbl_products WHERE status = $1';
    let orderQuery = 'SELECT COUNT(*) as count FROM tbl_orders';
    let customerQuery = 'SELECT COUNT(*) as count FROM tbl_customers WHERE status = $1';
    let supplierQuery = 'SELECT COUNT(*) as count FROM tbl_suppliers WHERE status = $1';
    let revenueQuery = 'SELECT COALESCE(SUM(total_amount), 0) as total FROM tbl_orders';
    let lowStockQuery = 'SELECT COUNT(*) as count FROM tbl_products WHERE qty_instock <= qty_alert AND status = $1';
    let pendingQuery = 'SELECT COUNT(*) as count FROM tbl_orders WHERE status = $1';
    let recentQuery = 'SELECT COUNT(*) as count FROM tbl_orders WHERE created_at >= NOW() - INTERVAL \'7 days\'';

    const baseParams = ['Active'];
    const params = [];
    const pendingParams = ['Pending'];

    if (isSuperAdmin) {
      const results = await Promise.all([
        pool.query(productQuery, baseParams),
        pool.query(orderQuery, []),
        pool.query(customerQuery, baseParams),
        pool.query(supplierQuery, baseParams),
        pool.query(revenueQuery, []),
        pool.query(lowStockQuery, baseParams),
        pool.query(pendingQuery, pendingParams),
        pool.query(recentQuery, []),
      ]);

      return res.json({
        totalProducts: parseInt(results[0].rows[0]?.count || 0),
        totalOrders: parseInt(results[1].rows[0]?.count || 0),
        totalCustomers: parseInt(results[2].rows[0]?.count || 0),
        totalSuppliers: parseInt(results[3].rows[0]?.count || 0),
        totalRevenue: parseFloat(results[4].rows[0]?.total || 0),
        lowStock: parseInt(results[5].rows[0]?.count || 0),
        pendingOrders: parseInt(results[6].rows[0]?.count || 0),
        recentOrders: parseInt(results[7].rows[0]?.count || 0),
      });
    }

    if (!tenantId) {
      return res.json({
        totalProducts: 0,
        totalOrders: 0,
        totalCustomers: 0,
        totalSuppliers: 0,
        totalRevenue: 0,
        lowStock: 0,
        pendingOrders: 0,
        recentOrders: 0,
      });
    }

    const results = await Promise.all([
      pool.query(productQuery + ' AND tenant_id = $2', [...baseParams, tenantId]),
      pool.query(orderQuery + ' WHERE tenant_id = $1', [tenantId]),
      pool.query(customerQuery + ' AND tenant_id = $2', [...baseParams, tenantId]),
      pool.query(supplierQuery + ' AND tenant_id = $2', [...baseParams, tenantId]),
      pool.query(revenueQuery + ' WHERE tenant_id = $1', [tenantId]),
      pool.query(lowStockQuery + ' AND tenant_id = $2', [...baseParams, tenantId]),
      pool.query(pendingQuery + ' AND tenant_id = $2', ['Pending', tenantId]),
      pool.query(recentQuery + ' WHERE tenant_id = $1', [tenantId]),
    ]);

    res.json({
      totalProducts: parseInt(results[0].rows[0]?.count || 0),
      totalOrders: parseInt(results[1].rows[0]?.count || 0),
      totalCustomers: parseInt(results[2].rows[0]?.count || 0),
      totalSuppliers: parseInt(results[3].rows[0]?.count || 0),
      totalRevenue: parseFloat(results[4].rows[0]?.total || 0),
      lowStock: parseInt(results[5].rows[0]?.count || 0),
      pendingOrders: parseInt(results[6].rows[0]?.count || 0),
      recentOrders: parseInt(results[7].rows[0]?.count || 0),
    });
  } catch (error) {
    console.error('❌ Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// ===== RECENT ORDERS =====
router.get('/recent', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;
  const { limit = 5 } = req.query;

  try {
    let query = `
      SELECT o.*, c.name_en as customer_name, u.fullname as created_by_name
      FROM tbl_orders o
      LEFT JOIN tbl_customers c ON c.id = o.customer_id
      LEFT JOIN tbl_users u ON u.userid = o.created_by
      WHERE 1=1
    `;
    const params = [];

    if (!isSuperAdmin && tenantId) {
      query += ` AND o.tenant_id = $1`;
      params.push(tenantId);
    }

    query += ` ORDER BY o.created_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Get recent orders error:', error);
    res.status(500).json({ error: 'Failed to fetch recent orders' });
  }
});

// ===== LOW STOCK =====
router.get('/low-stock', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;

  try {
    let query = `
      SELECT p.*, s.qtyavailable, s.qtyreserved 
      FROM tbl_products p
      JOIN tbl_stock s ON s.productid = p.id
      WHERE p.status = 'Active' AND s.qtyavailable <= p.qty_alert
    `;
    const params = [];

    if (!isSuperAdmin && tenantId) {
      query += ` AND p.tenant_id = $1`;
      params.push(tenantId);
    }

    query += ' ORDER BY s.qtyavailable ASC LIMIT 10';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Get low stock error:', error);
    res.status(500).json({ error: 'Failed to fetch low stock' });
  }
});

// ===== PENDING ORDERS =====
router.get('/pending', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;

  try {
    let query = `
      SELECT o.*, c.name_en as customer_name
      FROM tbl_orders o
      LEFT JOIN tbl_customers c ON c.id = o.customer_id
      WHERE o.status = 'Pending'
    `;
    const params = [];

    if (!isSuperAdmin && tenantId) {
      query += ` AND o.tenant_id = $1`;
      params.push(tenantId);
    }

    query += ' ORDER BY o.created_at DESC LIMIT 10';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Get pending orders error:', error);
    res.status(500).json({ error: 'Failed to fetch pending orders' });
  }
});

module.exports = router;
EOF

echo "✅ Dashboard route fixed"

# ============================================
# DONE
# ============================================
echo ""
echo "=========================================="
echo "✅ ALL ROUTES HAVE BEEN FIXED!"
echo "=========================================="
echo ""
echo "📁 Files Updated:"
echo "  - products.js"
echo "  - orders.js"
echo "  - customers.js"
echo "  - suppliers.js"
echo "  - stock.js"
echo "  - users.js"
echo "  - warranties.js"
echo "  - services.js"
echo "  - activity-logs.js"
echo "  - dashboard.js"
echo ""
echo "🚀 Next steps:"
echo "  1. git add backend/src/routes/"
echo "  2. git commit -m 'FIX: Complete tenant isolation for ALL routes'"
echo "  3. git push origin main"
echo "  4. Wait for Render to deploy"
echo "=========================================="