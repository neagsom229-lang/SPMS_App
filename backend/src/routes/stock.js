// backend/src/routes/stock.js
const express = require('express');
const pool = require('../config/postgres');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const getTenantId = (req) => {
  return req.user?.tenantId || req.tenantId || req.headers['x-tenant-id'];
};

// ===== GET STOCK =====
router.get('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;

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
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;

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

module.exports = router;
