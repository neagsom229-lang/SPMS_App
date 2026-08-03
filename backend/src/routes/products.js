// backend/src/routes/products.js
const express = require('express');
const pool = require('../config/postgres'); // ✅ Fix: Use postgres instead of database
const { authenticate } = require('../middleware/auth');
const jwt = require('jsonwebtoken'); // ✅ Add missing import

const router = express.Router();

// ===== HELPER: Get tenant ID from user =====
const getTenantId = (req) => {
  // If user is super admin, they might not have tenant_id
  if (req.user?.isSuperAdmin) {
    // Super admin can see all products
    return null;
  }
  return req.tenantId || req.user?.tenantId;
};

// ===== GET ALL PRODUCTS =====
router.get('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const { page = 1, limit = 20, search, category, status } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const isSuperAdmin = req.user?.isSuperAdmin || false;

  try {
    let query = `
      SELECT p.*, c.category_en, c.category_kh,
             s.name_en as supplier_name
      FROM tbl_products p
      LEFT JOIN tbl_categories c ON c.id = p.category_id AND c.tenant_id = p.tenant_id
      LEFT JOIN tbl_suppliers s ON s.id = p.supplier_id AND s.tenant_id = p.tenant_id
    `;
    const params = [];
    let paramIndex = 1;
    let whereClauses = [];

    // ✅ If not super admin, filter by tenant
    if (!isSuperAdmin && tenantId) {
      whereClauses.push(`p.tenant_id = $${paramIndex}`);
      params.push(tenantId);
      paramIndex++;
    }

    if (search) {
      whereClauses.push(`(p.name_en ILIKE $${paramIndex} OR p.name_kh ILIKE $${paramIndex} OR p.barcode ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (category) {
      whereClauses.push(`p.category_id = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    if (status) {
      whereClauses.push(`p.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    // Get total count
    const countQuery = query.replace(
      /SELECT p\.\*, c\.category_en, c\.category_kh, s\.name_en as supplier_name FROM/i,
      'SELECT COUNT(*) as total FROM'
    );
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0]?.total || 0);

    // Get paginated results
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
    let paramIndex = 2;

    // ✅ If not super admin, filter by tenant
    if (!isSuperAdmin && tenantId) {
      query += ` AND p.tenant_id = $${paramIndex}`;
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
  const userId = req.user?.userId;
  const isSuperAdmin = req.user?.isSuperAdmin || false;

  const {
    product_id, supplier_id, barcode, name_en, name_kh, brand, model,
    category_id, buyin_price, saleout_price, qty_instock, qty_alert, status
  } = req.body;

  if (!name_en || saleout_price === undefined) {
    return res.status(400).json({ error: 'Name and sale price are required' });
  }

  // ✅ Regular users must have a tenant
  if (!isSuperAdmin && !tenantId) {
    return res.status(403).json({ error: 'No tenant context found' });
  }

  try {
    // Check for duplicate barcode (only if tenant exists)
    if (barcode && tenantId) {
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
        tenantId || null, // Super admin can have null tenant_id
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
        status ? status.toUpperCase() : 'ACTIVE',
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
  const userId = req.user?.userId;
  const isSuperAdmin = req.user?.isSuperAdmin || false;

  try {
    // Check if product exists
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

    // ✅ Add tenant_id to WHERE clause if not super admin
    if (!isSuperAdmin && tenantId) {
      values.push(tenantId);
      const query = `
        UPDATE tbl_products 
        SET ${updates.join(', ')} 
        WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
        RETURNING *
      `;
      const result = await pool.query(query, [...values, req.params.id, tenantId]);
      return res.json(result.rows[0]);
    } else {
      const query = `
        UPDATE tbl_products 
        SET ${updates.join(', ')} 
        WHERE id = $${paramIndex}
        RETURNING *
      `;
      const result = await pool.query(query, [...values, req.params.id]);
      return res.json(result.rows[0]);
    }
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

// ===== BULK DELETE =====
router.delete('/bulk', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No product IDs provided' });
  }

  try {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    let query = `DELETE FROM tbl_products WHERE id IN (${placeholders})`;
    const params = [...ids];

    if (!isSuperAdmin && tenantId) {
      query += ` AND tenant_id = $${ids.length + 1}`;
      params.push(tenantId);
    }

    const result = await pool.query(query, params);

    res.json({
      message: `${result.rowCount} products deleted successfully`,
      deleted: result.rowCount
    });
  } catch (error) {
    console.error('❌ Bulk delete error:', error);
    res.status(500).json({ error: 'Failed to delete products' });
  }
});

// ===== BULK STOCK UPDATE =====
router.patch('/bulk-stock', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;
  const { ids, quantity, type = 'add' } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No product IDs provided' });
  }

  if (isNaN(quantity)) {
    return res.status(400).json({ error: 'Invalid quantity' });
  }

  try {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    let query = `
      UPDATE tbl_products 
      SET qty_instock = qty_instock + $${ids.length + 1},
          updated_at = NOW()
      WHERE id IN (${placeholders})
    `;
    const params = [...ids, parseInt(quantity)];

    if (!isSuperAdmin && tenantId) {
      query += ` AND tenant_id = $${params.length + 1}`;
      params.push(tenantId);
    }

    const result = await pool.query(query, params);

    res.json({
      message: `Stock updated for ${result.rowCount} products`,
      updated: result.rowCount
    });
  } catch (error) {
    console.error('❌ Bulk stock update error:', error);
    res.status(500).json({ error: 'Failed to update stock' });
  }
});

// ===== EXPORT PRODUCTS =====
router.get('/export', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;
  const { ids } = req.query;

  try {
    let query = 'SELECT * FROM tbl_products';
    const params = [];
    let paramIndex = 1;
    let whereClauses = [];

    if (!isSuperAdmin && tenantId) {
      whereClauses.push(`tenant_id = $${paramIndex}`);
      params.push(tenantId);
      paramIndex++;
    }

    if (ids) {
      const idArray = ids.split(',');
      const placeholders = idArray.map((_, i) => `$${paramIndex + i}`).join(',');
      whereClauses.push(`id IN (${placeholders})`);
      params.push(...idArray);
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    query += ' ORDER BY id';

    const result = await pool.query(query, params);

    res.json({
      products: result.rows,
      count: result.rows.length,
      exportDate: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Export error:', error);
    res.status(500).json({ error: 'Failed to export products' });
  }
});

module.exports = router;