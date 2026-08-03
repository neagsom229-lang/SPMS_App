// backend/src/routes/customers.js
const express = require('express');
const pool = require('../config/postgres');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ===== HELPER: Get tenant ID =====
const getTenantId = (req) => {
  return req.user?.tenantId || req.tenantId || req.headers['x-tenant-id'];
};

// ===== GET ALL CUSTOMERS (Only current tenant) =====
router.get('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;
  const { search } = req.query;

  try {
    let sql = "SELECT * FROM tbl_customers WHERE status = 'Active'";
    const params = [];

    if (!isSuperAdmin && tenantId) {
      sql += " AND tenant_id = $1";
      params.push(tenantId);
    }

    if (search) {
      const paramIndex = params.length + 1;
      sql += ` AND (first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex} OR phone ILIKE $${paramIndex} OR e_mail ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
    }

    sql += " ORDER BY first_name ASC";

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Customers error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===== CREATE CUSTOMER (With tenant_id) =====
router.post('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  
  if (!tenantId) {
    return res.status(403).json({ error: 'Tenant context required' });
  }

  const { FIRST_NAME, LAST_NAME, PHONE, E_MAIL, ADDRESS, BALANCE } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO tbl_customers 
       (tenant_id, cus_id, first_name, last_name, phone, e_mail, address, balance, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Active', NOW())
       RETURNING *`,
      [
        tenantId,
        `CUS${String(Date.now()).slice(-6)}`,
        FIRST_NAME,
        LAST_NAME,
        PHONE || null,
        E_MAIL || null,
        ADDRESS || null,
        BALANCE || 0
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Create customer error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;