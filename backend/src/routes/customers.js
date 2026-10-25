// backend/src/routes/customers.js
const express = require('express');
const pool = require('../config/postgres');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const getTenantId = (req) => {
  return req.user?.tenantId || req.tenantId || req.headers['x-tenant-id'];
};

// ===== GET ALL CUSTOMERS =====
router.get('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;
  const { search } = req.query;

  try {
    let sql = "SELECT * FROM tbl_customers WHERE LOWER(status) = 'active'";
    const params = [];

    if (!isSuperAdmin && tenantId) {
      sql += " AND tenant_id = $1";
      params.push(tenantId);
    }

    if (search) {
      const paramIndex = params.length + 1;
      sql += ` AND (name ILIKE $${paramIndex} OR phone ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
    }

    sql += " ORDER BY name ASC";

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Customers error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===== CREATE CUSTOMER =====
router.post('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  
  if (!tenantId) {
    return res.status(403).json({ error: 'Tenant context required' });
  }

  const { name, FIRST_NAME, LAST_NAME, phone, PHONE, email, E_MAIL, address, ADDRESS } = req.body;
  const customerName = name || `${FIRST_NAME || ''} ${LAST_NAME || ''}`.trim() || 'Customer';
  const customerPhone = phone || PHONE || null;
  const customerEmail = email || E_MAIL || null;
  const customerAddress = address || ADDRESS || null;

  try {
    const result = await pool.query(
      `INSERT INTO tbl_customers 
       (tenant_id, cus_id, name, email, phone, address, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'Active', NOW())
       RETURNING *`,
      [
        tenantId,
        `CUS${String(Date.now()).slice(-6)}`,
        customerName,
        customerEmail,
        customerPhone,
        customerAddress
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Create customer error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
