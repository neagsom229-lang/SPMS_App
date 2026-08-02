// backend/src/routes/stock.js
const express = require('express');
const db = require('../config/postgres');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ===== GET STOCK =====
router.get('/', authenticate, async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
  
  const isSuperAdmin = decoded.isSuperAdmin || false;
  const tenantId = decoded.tenantId;

  try {
    let sql = `
      SELECT s.*, p.product_id as product_code, p.name_en, p.name_kh, p.qty_alert, p.saleout_price
      FROM tbl_stock s
      LEFT JOIN tbl_products p ON s.productid = p.id
    `;
    const params = [];

    if (!isSuperAdmin && tenantId) {
      sql += ` WHERE p.tenant_id = $1`;
      params.push(tenantId);
    }

    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Stock error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===== GET LOW STOCK =====
router.get('/low-stock', authenticate, async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
  
  const isSuperAdmin = decoded.isSuperAdmin || false;
  const tenantId = decoded.tenantId;

  try {
    let sql = `
      SELECT p.product_id, p.name_en, p.name_kh, s.qtyavailable, p.qty_alert, p.saleout_price
      FROM tbl_stock s
      LEFT JOIN tbl_products p ON s.productid = p.id
      WHERE s.qtyavailable <= p.qty_alert AND p.status = 'Active'
    `;
    const params = [];

    if (!isSuperAdmin && tenantId) {
      sql += ` AND p.tenant_id = $1`;
      params.push(tenantId);
    }

    sql += ` ORDER BY s.qtyavailable ASC`;

    const result = await db.query(sql, params);
    res.json(result.rows || []);
  } catch (err) {
    console.error("❌ Low stock error:", err.message);
    res.status(500).json([]);
  }
});

module.exports = router;