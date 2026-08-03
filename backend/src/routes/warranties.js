// backend/src/routes/warranties.js
const express = require('express');
const pool = require('../config/postgres');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const getTenantId = (req) => {
  return req.user?.tenantId || req.tenantId || req.headers['x-tenant-id'];
};

// ===== GET WARRANTIES =====
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