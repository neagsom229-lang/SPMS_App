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

  const b = req.body || {};
  const pick = (...keys) => {
    for (const k of keys) {
      if (b[k] !== undefined && b[k] !== null && b[k] !== '') return b[k];
    }
    return undefined;
  };

  const name = String(pick('name', 'name_en') || '').trim();
  const nameKh = pick('name_kh') ? String(pick('name_kh')).trim() : null;
  const barcodeRaw = pick('barcode', 'product_id');
  const barcode = barcodeRaw !== undefined ? String(barcodeRaw).trim() : null;
  const brand = pick('brand') ? String(pick('brand')).trim().slice(0, 100) : null;
  const model = pick('model') ? String(pick('model')).trim().slice(0, 100) : null;
  const price = Number(pick('price', 'saleout_price'));
  const costRaw = pick('cost', 'buyin_price');
  const cost = costRaw === undefined ? 0 : Number(costRaw);
  const stockRaw = pick('stock', 'qty_instock');
  const initialQty = stockRaw === undefined ? 0 : Number(stockRaw);
  const alertRaw = pick('qty_alert');
  const qtyAlert = alertRaw === undefined ? 5 : Number(alertRaw);
  const categoryId = pick('category_id') !== undefined ? Number(pick('category_id')) : null;
  const supplierId = pick('supplier_id') !== undefined ? Number(pick('supplier_id')) : null;
  const status = String(pick('status') || 'Active').trim().toLowerCase() === 'inactive' ? 'Inactive' : 'Active';
  const isPublished = b.is_published === undefined ? true : (b.is_published === true || b.is_published === 'true' || b.is_published === 1 || b.is_published === '1');
  const descEn = pick('description_en') ? String(pick('description_en')).slice(0, 2000) : null;
  const descKh = pick('description_kh') ? String(pick('description_kh')).slice(0, 2000) : null;
  const imageUrl = pick('image_url') ? String(pick('image_url')).slice(0, 2000) : null;

  if (!name || name.length > 200) {
    return res.status(400).json({ error: 'Product name is required (max 200 characters)' });
  }
  if (!Number.isFinite(price) || price < 0 || price > 10000000) {
    return res.status(400).json({ error: 'A valid sale price is required' });
  }
  if (!Number.isFinite(cost) || cost < 0 || cost > 10000000) {
    return res.status(400).json({ error: 'Cost must be a number of 0 or more' });
  }
  if (!Number.isInteger(initialQty) || initialQty < 0 || initialQty > 1000000) {
    return res.status(400).json({ error: 'Stock must be a whole number between 0 and 1,000,000' });
  }
  if (!Number.isInteger(qtyAlert) || qtyAlert < 0) {
    return res.status(400).json({ error: 'Alert level must be a whole number of 0 or more' });
  }
  if (categoryId !== null && !Number.isInteger(categoryId)) {
    return res.status(400).json({ error: 'category_id must be a number' });
  }
  if (supplierId !== null && !Number.isInteger(supplierId)) {
    return res.status(400).json({ error: 'supplier_id must be a number' });
  }

  try {
    if (categoryId !== null) {
      const c = await pool.query('SELECT 1 FROM tbl_categories WHERE id = $1 AND tenant_id = $2', [categoryId, tenantId]);
      if (c.rowCount === 0) return res.status(400).json({ error: 'Category not found' });
    }
    if (supplierId !== null) {
      const s = await pool.query('SELECT 1 FROM tbl_suppliers WHERE id = $1 AND tenant_id = $2', [supplierId, tenantId]);
      if (s.rowCount === 0) return res.status(400).json({ error: 'Supplier not found' });
    }
    if (barcode) {
      const d = await pool.query('SELECT 1 FROM tbl_products WHERE tenant_id = $1 AND LOWER(barcode) = LOWER($2)', [tenantId, barcode]);
      if (d.rowCount > 0) return res.status(409).json({ error: 'A product with this barcode already exists' });
    }
  } catch (checkErr) {
    console.error('Create product check error:', checkErr.message);
    return res.status(500).json({ error: 'Failed to create product' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const productResult = await client.query(
      'INSERT INTO tbl_products (tenant_id, barcode, name, name_kh, brand, model, category_id, supplier_id, price, cost, stock, qty_alert, status, is_published, description_en, description_kh, image_url, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW()) RETURNING *',
      [tenantId, barcode, name, nameKh, brand, model, categoryId, supplierId, price, cost, initialQty, qtyAlert, status, isPublished, descEn, descKh, imageUrl]
    );
    const product = productResult.rows[0];

    await client.query(
      'INSERT INTO tbl_stock (productid, qtyinstock, qtyavailable, tenant_id) VALUES ($1, $2, $3, $4)',
      [product.id, initialQty, initialQty, tenantId]
    );

    if (initialQty > 0) {
      const who = req.user && (req.user.userId || req.user.id);
      await client.query(
        'INSERT INTO tbl_stock_log (tenant_id, product_id, change_qty, type, reference_id, notes) VALUES ($1, $2, $3, $4, $5, $6)',
        [tenantId, product.id, initialQty, 'RESTOCK', null, 'Initial stock' + (who ? ' (user ' + who + ')' : '')]
      );
    }

    await client.query('COMMIT');
    clearTenantCache(tenantId);

    product.name_en = product.name;
    product.saleout_price = product.price;
    product.qty_instock = initialQty;
    product.stock = initialQty;
    res.status(201).json(product);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Create product error:', error.message);
    if (error.code === '23505') return res.status(409).json({ error: 'A product with this barcode already exists' });
    if (error.code === '23503') return res.status(400).json({ error: 'Invalid category or supplier' });
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
      cost: 'cost',
      buyin_price: 'cost',
      image_url: 'image_url',
      description_en: 'description_en',
      description_kh: 'description_kh',
      is_published: 'is_published',
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
        if (key === 'status') val = String(val).trim().toLowerCase() === 'inactive' ? 'Inactive' : 'Active';
        if (key === 'cost' || key === 'buyin_price') { val = Number(val); if (!Number.isFinite(val) || val < 0 || val > 10000000) return res.status(400).json({ error: 'Cost must be a number of 0 or more' }); }
        if (key === 'is_published') val = (val === true || val === 'true' || val === 1 || val === '1');
        if (['price', 'saleout_price'].includes(key)) { val = Number(val); if (!Number.isFinite(val) || val < 0 || val > 10000000) return res.status(400).json({ error: 'A valid sale price is required' }); }
        if (['qty_alert'].includes(key)) { val = parseInt(val, 10); if (!Number.isInteger(val) || val < 0) return res.status(400).json({ error: 'Alert level must be a whole number of 0 or more' }); }
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
    let query = "UPDATE tbl_products SET status = 'Inactive', is_published = false WHERE id = $1";
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
