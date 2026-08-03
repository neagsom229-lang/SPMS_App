// backend/src/routes/products.js
const express = require('express');
const pool = require('../config/postgres');
const { authenticate } = require('../middleware/auth');
const jwt = require('jsonwebtoken');

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

    // ✅ If not super admin, filter by tenant
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

    // Get total count
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

// ===== GET PRODUCT BY ID (Only if belongs to tenant) =====
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

// ===== CREATE PRODUCT (With tenant_id) =====
router.post('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const userId = req.user?.userId;

  if (!tenantId) {
    return res.status(403).json({ error: 'Tenant context required' });
  }

  const {
    product_id, supplier_id, barcode, name_en, name_kh, brand, model,
    category_id, buyin_price, saleout_price, qty_instock, qty_alert, status
  } = req.body;

  if (!name_en || saleout_price === undefined) {
    return res.status(400).json({ error: 'Name and sale price are required' });
  }

  try {
    // Check duplicate barcode within tenant
    if (barcode) {
      const existing = await pool.query(
        'SELECT id FROM tbl_products WHERE barcode = $1 AND tenant_id = $2',
        [barcode, tenantId]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Product with this barcode already exists' });
      }
    }

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

// ===== UPDATE PRODUCT (Only if belongs to tenant) =====
router.put('/:id', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const userId = req.user?.userId;

  try {
    // Check if product exists and belongs to tenant
    const existing = await pool.query(
      'SELECT * FROM tbl_products WHERE id = $1 AND tenant_id = $2',
      [req.params.id, tenantId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found or unauthorized' });
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

// ===== DELETE PRODUCT (Only if belongs to tenant) =====
router.delete('/:id', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);

  try {
    const result = await pool.query(
      'DELETE FROM tbl_products WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [req.params.id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found or unauthorized' });
    }

    res.status(204).end();
  } catch (error) {
    console.error('❌ Delete product error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = router;