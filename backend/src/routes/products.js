const express = require('express');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ===== GET ALL PRODUCTS =====
router.get('/', authenticate, async (req, res) => {
  const tenantId = req.tenantId || req.user?.tenantId;
  const { page = 1, limit = 20, search, category, status } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let query = `
      SELECT p.*, c.category_en, c.category_kh,
             s.name_en as supplier_name
      FROM tbl_products p
      LEFT JOIN tbl_categories c ON c.id = p.category_id AND c.tenant_id = p.tenant_id
      LEFT JOIN tbl_suppliers s ON s.id = p.supplier_id AND s.tenant_id = p.tenant_id
      WHERE p.tenant_id = $1
    `;
    const params = [tenantId];
    let paramIndex = 2;

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
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// ===== GET PRODUCT BY ID =====
router.get('/:id', authenticate, async (req, res) => {
  const tenantId = req.tenantId || req.user?.tenantId;

  try {
    const result = await pool.query(
      `SELECT p.*, c.category_en, c.category_kh, s.name_en as supplier_name
       FROM tbl_products p
       LEFT JOIN tbl_categories c ON c.id = p.category_id AND c.tenant_id = p.tenant_id
       LEFT JOIN tbl_suppliers s ON s.id = p.supplier_id AND s.tenant_id = p.tenant_id
       WHERE p.id = $1 AND p.tenant_id = $2`,
      [req.params.id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// ===== CREATE PRODUCT =====
router.post('/', authenticate, async (req, res) => {
  const tenantId = req.tenantId || req.user?.tenantId;
  const userId = req.user?.userId;
  const {
    product_id, supplier_id, barcode, name_en, name_kh, brand, model,
    category_id, buyin_price, saleout_price, qty_instock, qty_alert, status
  } = req.body;

  if (!name_en || saleout_price === undefined) {
    return res.status(400).json({ error: 'Name and sale price are required' });
  }

  try {
    // Check for duplicate barcode
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
        buyin_price || 0,
        saleout_price,
        qty_instock || 0,
        qty_alert || 0,
        status || 'ACTIVE',
        userId || null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// ===== UPDATE PRODUCT =====
router.put('/:id', authenticate, async (req, res) => {
  const tenantId = req.tenantId || req.user?.tenantId;
  const userId = req.user?.userId;

  try {
    // Check if product exists
    const existing = await pool.query(
      'SELECT * FROM tbl_products WHERE id = $1 AND tenant_id = $2',
      [req.params.id, tenantId]
    );

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
    values.push(req.params.id, tenantId);

    const query = `
      UPDATE tbl_products 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
      RETURNING *
    `;

    const result = await pool.query(query, [...values, req.params.id, tenantId]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// ===== DELETE PRODUCT =====
router.delete('/:id', authenticate, async (req, res) => {
  const tenantId = req.tenantId || req.user?.tenantId;

  try {
    const result = await pool.query(
      'DELETE FROM tbl_products WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [req.params.id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.status(204).end();
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// ===== BULK DELETE =====
router.delete('/bulk', authenticate, async (req, res) => {
  const tenantId = req.tenantId || req.user?.tenantId;
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No product IDs provided' });
  }

  try {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const query = `
      DELETE FROM tbl_products 
      WHERE id IN (${placeholders}) AND tenant_id = $${ids.length + 1}
    `;
    const result = await pool.query(query, [...ids, tenantId]);

    res.json({
      message: `${result.rowCount} products deleted successfully`,
      deleted: result.rowCount
    });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: 'Failed to delete products' });
  }
});

// ===== BULK STOCK UPDATE =====
router.patch('/bulk-stock', authenticate, async (req, res) => {
  const tenantId = req.tenantId || req.user?.tenantId;
  const { ids, quantity, type = 'add' } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No product IDs provided' });
  }

  if (isNaN(quantity)) {
    return res.status(400).json({ error: 'Invalid quantity' });
  }

  try {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const query = `
      UPDATE tbl_products 
      SET qty_instock = qty_instock + $${ids.length + 1},
          updated_at = NOW()
      WHERE id IN (${placeholders}) AND tenant_id = $${ids.length + 2}
    `;
    const result = await pool.query(query, [...ids, quantity, tenantId]);

    res.json({
      message: `Stock updated for ${result.rowCount} products`,
      updated: result.rowCount
    });
  } catch (error) {
    console.error('Bulk stock update error:', error);
    res.status(500).json({ error: 'Failed to update stock' });
  }
});

// ===== EXPORT PRODUCTS =====
router.get('/export', authenticate, async (req, res) => {
  const tenantId = req.tenantId || req.user?.tenantId;
  const { ids } = req.query;

  try {
    let query = 'SELECT * FROM tbl_products WHERE tenant_id = $1';
    const params = [tenantId];

    if (ids) {
      const idArray = ids.split(',');
      const placeholders = idArray.map((_, i) => `$${i + 2}`).join(',');
      query += ` AND id IN (${placeholders})`;
      params.push(...idArray);
    }

    query += ' ORDER BY id';

    const result = await pool.query(query, params);

    res.json({
      products: result.rows,
      count: result.rows.length,
      exportDate: new Date().toISOString()
    });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export products' });
  }
});

module.exports = router;