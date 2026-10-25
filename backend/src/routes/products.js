// backend/src/routes/products.js
const express = require('express');
const pool = require('../config/postgres');
const { authenticate, getScope } = require('../middleware/auth');
const { clearTenantCache } = require('../middleware/cache');

const router = express.Router();

// ===== GET ALL PRODUCTS =====
router.get('/', authenticate, async (req, res) => {
  const scope = getScope(req, res);
  if (!scope) return;
  const { page = 1, limit = 20, search, category, status } = req.query;
  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  try {
    let whereClause = ' WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (!scope.isSuperAdmin || scope.tenantId) {
      whereClause += ` AND p.tenant_id = $${paramIndex}`;
      params.push(scope.tenantId);
      paramIndex++;
    }

    if (search) {
      whereClause += ` AND (p.name ILIKE $${paramIndex} OR p.name_kh ILIKE $${paramIndex} OR p.barcode ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (category) {
      whereClause += ` AND p.category_id = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (status) {
      whereClause += ` AND p.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Direct count query
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM tbl_products p 
      LEFT JOIN tbl_categories c ON c.id = p.category_id AND c.tenant_id = p.tenant_id
      LEFT JOIN tbl_suppliers s ON s.id = p.supplier_id AND s.tenant_id = p.tenant_id
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0]?.total || 0, 10);

    const query = `
      SELECT p.*, 
             p.name as name_en,
             p.price as saleout_price,
             c.name as category_en, 
             c.name as category_name, 
             s.sup_name as supplier_name,
             COALESCE(st.qtyavailable, 0) as qtyavailable
      FROM tbl_products p
      LEFT JOIN tbl_categories c ON c.id = p.category_id AND c.tenant_id = p.tenant_id
      LEFT JOIN tbl_suppliers s ON s.id = p.supplier_id AND s.tenant_id = p.tenant_id
      LEFT JOIN tbl_stock st ON st.productid = p.id AND st.tenant_id = p.tenant_id
      ${whereClause}
      ORDER BY p.id DESC 
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(parseInt(limit, 10), offset);

    const result = await pool.query(query, params);

    res.json({
      products: result.rows,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        totalPages: Math.ceil(total / parseInt(limit, 10))
      }
    });
  } catch (error) {
    console.error('❌ Get products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// ===== GET PRODUCT BY ID =====
router.get('/:id', authenticate, async (req, res) => {
  const scope = getScope(req, res);
  if (!scope) return;

  try {
    let query = `
      SELECT p.*, 
             p.name as name_en,
             p.price as saleout_price,
             c.name as category_en, 
             c.name as category_name, 
             s.sup_name as supplier_name,
             COALESCE(st.qtyavailable, 0) as qtyavailable
      FROM tbl_products p
      LEFT JOIN tbl_categories c ON c.id = p.category_id AND c.tenant_id = p.tenant_id
      LEFT JOIN tbl_suppliers s ON s.id = p.supplier_id AND s.tenant_id = p.tenant_id
      LEFT JOIN tbl_stock st ON st.productid = p.id AND st.tenant_id = p.tenant_id
      WHERE p.id = $1
    `;
    const params = [req.params.id];

    if (!scope.isSuperAdmin || scope.tenantId) {
      query += ` AND p.tenant_id = $2`;
      params.push(scope.tenantId);
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
  const scope = getScope(req, res);
  if (!scope) return;

  const tenantId = scope.tenantId;
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID is required for creation' });
  }

  const {
    product_id, supplier_id, barcode, name, name_en, name_kh, brand, model,
    category_id, price, saleout_price, qty_alert, status, qty_instock
  } = req.body;

  const effectiveName = name || name_en;
  const effectivePrice = parseFloat(price !== undefined ? price : saleout_price) || 0;

  if (!effectiveName || effectivePrice === undefined) {
    return res.status(400).json({ error: 'Name and sale price are required' });
  }

  const initialQty = parseInt(qty_instock, 10) || 0;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const productResult = await client.query(
      `INSERT INTO tbl_products 
        (tenant_id, barcode, name, name_kh, brand, model,
         category_id, supplier_id, price, qty_alert, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
       RETURNING *`,
      [
        tenantId,
        barcode || product_id || null,
        effectiveName,
        name_kh ? name_kh.trim() : null,
        brand || null,
        model || null,
        category_id || null,
        supplier_id || null,
        effectivePrice,
        parseInt(qty_alert, 10) || 0,
        status || 'ACTIVE'
      ]
    );

    const product = productResult.rows[0];
    product.name_en = product.name;

    // Maintain inventory in tbl_stock
    await client.query(
      `INSERT INTO tbl_stock (productid, qtyinstock, qtyavailable, tenant_id)
       VALUES ($1, $2, $3, $4)`,
      [product.id, initialQty, initialQty, tenantId]
    );

    await client.query('COMMIT');
    clearTenantCache(tenantId);
    res.status(201).json(product);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Create product error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  } finally {
    client.release();
  }
});

// ===== UPDATE PRODUCT =====
router.put('/:id', authenticate, async (req, res) => {
  const scope = getScope(req, res);
  if (!scope) return;

  const tenantId = scope.tenantId;

  try {
    let checkQuery = 'SELECT * FROM tbl_products WHERE id = $1';
    const checkParams = [req.params.id];

    if (!scope.isSuperAdmin && tenantId) {
      checkQuery += ' AND tenant_id = $2';
      checkParams.push(tenantId);
    }

    const existing = await pool.query(checkQuery, checkParams);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const fieldMapping = {
      barcode: 'barcode',
      name: 'name',
      name_en: 'name',
      name_kh: 'name_kh',
      brand: 'brand',
      model: 'model',
      category_id: 'category_id',
      supplier_id: 'supplier_id',
      price: 'price',
      saleout_price: 'price',
      qty_alert: 'qty_alert',
      status: 'status'
    };

    const updates = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, column] of Object.entries(fieldMapping)) {
      if (req.body[key] !== undefined && !updates.some(u => u.startsWith(`${column} =`))) {
        updates.push(`${column} = $${paramIndex}`);
        let val = req.body[key];
        if (key === 'name_kh' && val) val = val.trim();
        if (['price', 'saleout_price'].includes(key)) val = parseFloat(val) || 0;
        if (['qty_alert'].includes(key)) val = parseInt(val, 10) || 0;
        values.push(val);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(req.params.id);
    values.push(tenantId);

    const query = `
      UPDATE tbl_products 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    const updatedProduct = result.rows[0];
    if (updatedProduct) updatedProduct.name_en = updatedProduct.name;

    clearTenantCache(tenantId);
    res.json(updatedProduct);
  } catch (error) {
    console.error('❌ Update product error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// ===== DELETE PRODUCT =====
router.delete('/:id', authenticate, async (req, res) => {
  const scope = getScope(req, res);
  if (!scope) return;

  try {
    let query = 'DELETE FROM tbl_products WHERE id = $1';
    const params = [req.params.id];

    if (!scope.isSuperAdmin && scope.tenantId) {
      query += ' AND tenant_id = $2';
      params.push(scope.tenantId);
    }

    const result = await pool.query(query, params);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    clearTenantCache(scope.tenantId);
    res.status(204).end();
  } catch (error) {
    console.error('❌ Delete product error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = router;
