// backend/src/routes/stock.js
const express = require('express');
const pool = require('../config/postgres');
const { authenticate, getScope } = require('../middleware/auth');

const router = express.Router();

const getTenantId = (req, res) => {
  const scope = getScope(req, res);
  return scope ? scope.tenantId : null;
};

// ===== GET STOCK =====
router.get('/', authenticate, async (req, res) => {
  const scope = getScope(req, res);
  if (!scope) return;
  const tenantId = scope.tenantId;
  const isSuperAdmin = scope.isSuperAdmin;

  try {
    let query = `
      SELECT s.*, p.barcode as product_code, p.name as name_en, p.name_kh, p.qty_alert, p.price as saleout_price
      FROM tbl_stock s
      LEFT JOIN tbl_products p ON s.productid = p.id
      WHERE 1=1
    `;
    const params = [];

    if (!isSuperAdmin && tenantId) {
      query += ` AND s.tenant_id = $1`;
      params.push(tenantId);
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Stock error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===== LOW STOCK =====
router.get('/low-stock', authenticate, async (req, res) => {
  const scope = getScope(req, res);
  if (!scope) return;
  const tenantId = scope.tenantId;
  const isSuperAdmin = scope.isSuperAdmin;

  try {
    let query = `
      SELECT p.id as product_id, p.barcode as product_code, p.name as name_en, p.name_kh, s.qtyavailable, p.qty_alert, p.price as saleout_price
      FROM tbl_stock s
      LEFT JOIN tbl_products p ON s.productid = p.id
      WHERE s.qtyavailable <= COALESCE(p.qty_alert, 5) AND LOWER(p.status) = 'active'
    `;
    const params = [];

    if (!isSuperAdmin && tenantId) {
      query += ` AND s.tenant_id = $1`;
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

// ===== GET STOCK LOG =====
router.get('/log', authenticate, async (req, res) => {
  const scope = getScope(req, res);
  if (!scope) return;
  const tenantId = scope.tenantId;
  if (!tenantId) {
    return res.status(403).json({ error: 'Tenant context required' });
  }

  const { product_id, limit } = req.query;
  const parsedLimit = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));

  try {
    let query = `
      SELECT l.*, p.name as product_name, p.barcode as product_code
      FROM tbl_stock_log l
      LEFT JOIN tbl_products p ON p.id = l.product_id
      WHERE l.tenant_id = $1
    `;
    const params = [tenantId];
    let idx = 2;

    if (product_id) {
      query += ` AND l.product_id = $${idx++}`;
      params.push(product_id);
    }

    query += ` ORDER BY l.created_at DESC, l.id DESC LIMIT $${idx}`;
    params.push(parsedLimit);

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Stock log error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===== RECEIVE STOCK =====
router.post('/receive', authenticate, async (req, res) => {
  const scope = getScope(req, res);
  if (!scope) return;
  const tenantId = scope.tenantId;
  if (!tenantId) {
    return res.status(403).json({ error: 'Tenant context required' });
  }
  const userId = req.user?.userId;

  const { product_id, qty, reason, note } = req.body;

  if (!product_id || typeof qty !== 'number' || !Number.isInteger(qty) || qty < 1 || qty > 1000000) {
    return res.status(400).json({ error: 'Invalid product_id or qty (must be integer between 1 and 1,000,000)' });
  }

  const validReasons = ['Purchase', 'Return', 'Correction', 'Opening balance'];
  if (!reason || !validReasons.includes(reason)) {
    return res.status(400).json({ error: `Invalid reason. Must be one of: ${validReasons.join(', ')}` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check product belongs to tenant
    const prodCheck = await client.query(
      'SELECT id FROM tbl_products WHERE id = $1 AND tenant_id = $2',
      [product_id, tenantId]
    );
    if (prodCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Product not found' });
    }

    // SELECT ... FOR UPDATE (create row if missing)
    let stockRes = await client.query(
      'SELECT * FROM tbl_stock WHERE productid = $1 AND tenant_id = $2 FOR UPDATE',
      [product_id, tenantId]
    );

    if (stockRes.rows.length === 0) {
      await client.query(
        `INSERT INTO tbl_stock (productid, tenant_id, qtyinstock, qtyavailable)
         VALUES ($1, $2, 0, 0)`,
        [product_id, tenantId]
      );
      stockRes = await client.query(
        'SELECT * FROM tbl_stock WHERE productid = $1 AND tenant_id = $2 FOR UPDATE',
        [product_id, tenantId]
      );
    }

    const stockRow = stockRes.rows[0];
    const newQtyInStock = (parseInt(stockRow.qtyinstock, 10) || 0) + qty;
    const newQtyAvailable = (parseInt(stockRow.qtyavailable, 10) || 0) + qty;

    await client.query(
      'UPDATE tbl_stock SET qtyinstock = $1, qtyavailable = $2 WHERE id = $3',
      [newQtyInStock, newQtyAvailable, stockRow.id]
    );

    const notesStr = `${reason}${note ? ' - ' + note : ''} (User: ${userId || 'system'})`;

    await client.query(
      `INSERT INTO tbl_stock_log (tenant_id, product_id, change_qty, type, notes, created_at)
       VALUES ($1, $2, $3, 'RESTOCK', $4, NOW())`,
      [tenantId, product_id, qty, notesStr]
    );

    await client.query('COMMIT');
    client.release();

    res.json({
      success: true,
      product_id,
      qtyinstock: newQtyInStock,
      qtyavailable: newQtyAvailable
    });
  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    console.error('❌ Receive stock error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===== ADJUST STOCK =====
router.post('/adjust', authenticate, async (req, res) => {
  const scope = getScope(req, res);
  if (!scope) return;
  const tenantId = scope.tenantId;
  if (!tenantId) {
    return res.status(403).json({ error: 'Tenant context required' });
  }
  const userId = req.user?.userId;

  const { product_id, new_qty, reason, note } = req.body;

  if (!product_id || typeof new_qty !== 'number' || !Number.isInteger(new_qty) || new_qty < 0) {
    return res.status(400).json({ error: 'Invalid product_id or new_qty (must be integer >= 0)' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check product belongs to tenant
    const prodCheck = await client.query(
      'SELECT id FROM tbl_products WHERE id = $1 AND tenant_id = $2',
      [product_id, tenantId]
    );
    if (prodCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Product not found' });
    }

    // SELECT ... FOR UPDATE (create row if missing)
    let stockRes = await client.query(
      'SELECT * FROM tbl_stock WHERE productid = $1 AND tenant_id = $2 FOR UPDATE',
      [product_id, tenantId]
    );

    if (stockRes.rows.length === 0) {
      await client.query(
        `INSERT INTO tbl_stock (productid, tenant_id, qtyinstock, qtyavailable)
         VALUES ($1, $2, 0, 0)`,
        [product_id, tenantId]
      );
      stockRes = await client.query(
        'SELECT * FROM tbl_stock WHERE productid = $1 AND tenant_id = $2 FOR UPDATE',
        [product_id, tenantId]
      );
    }

    const stockRow = stockRes.rows[0];
    const currentQty = parseInt(stockRow.qtyavailable, 10) || 0;
    const changeQty = new_qty - currentQty;

    await client.query(
      'UPDATE tbl_stock SET qtyinstock = $1, qtyavailable = $2 WHERE id = $3',
      [new_qty, new_qty, stockRow.id]
    );

    const notesStr = `${reason || 'Adjustment'}${note ? ' - ' + note : ''} (User: ${userId || 'system'})`;

    await client.query(
      `INSERT INTO tbl_stock_log (tenant_id, product_id, change_qty, type, notes, created_at)
       VALUES ($1, $2, $3, 'ADJUSTMENT', $4, NOW())`,
      [tenantId, product_id, changeQty, notesStr]
    );

    await client.query('COMMIT');
    client.release();

    res.json({
      success: true,
      product_id,
      qtyinstock: new_qty,
      qtyavailable: new_qty,
      change_qty: changeQty
    });
  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    console.error('❌ Adjust stock error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===== CREATE STOCK =====
router.post('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req, res);
  if (!tenantId) return;
  const { product_id, qtyinstock, qtyavailable } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO tbl_stock (productid, qtyinstock, qtyavailable, tenant_id) VALUES ($1, $2, $3, $4) RETURNING *`,
      [product_id, qtyinstock || 0, qtyavailable || 0, tenantId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== UPDATE STOCK =====
router.put('/:id', authenticate, async (req, res) => {
  const tenantId = getTenantId(req, res);
  if (!tenantId) return;
  const id = req.params.id;
  const { qtyinstock, qtyavailable } = req.body;
  try {
    const result = await pool.query(
      `UPDATE tbl_stock SET qtyinstock = COALESCE($1, qtyinstock), qtyavailable = COALESCE($2, qtyavailable) WHERE id = $3 AND tenant_id = $4 RETURNING *`,
      [qtyinstock, qtyavailable, id, tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Stock record not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== DELETE STOCK =====
router.delete('/:id', authenticate, async (req, res) => {
  const tenantId = getTenantId(req, res);
  if (!tenantId) return;
  const id = req.params.id;
  try {
    const result = await pool.query(`DELETE FROM tbl_stock WHERE id = $1 AND tenant_id = $2 RETURNING id`, [id, tenantId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Stock record not found' });
    res.json({ message: 'Stock record deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
