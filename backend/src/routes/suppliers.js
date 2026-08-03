// backend/src/routes/suppliers.js
const express = require('express');
const pool = require('../config/postgres');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ===== HELPER: Get tenant ID =====
const getTenantId = (req) => {
  return req.user?.tenantId || req.tenantId || req.headers['x-tenant-id'];
};

// ===== GET ALL SUPPLIERS (Only current tenant) =====
router.get('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;
  const { search } = req.query;

  try {
    let sql = "SELECT * FROM tbl_suppliers WHERE status = 'Active'";
    const params = [];

    if (!isSuperAdmin && tenantId) {
      sql += " AND tenant_id = $1";
      params.push(tenantId);
    }

    if (search) {
      const paramIndex = params.length + 1;
      sql += ` AND (company ILIKE $${paramIndex} OR first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex} OR phone ILIKE $${paramIndex} OR e_mail ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
    }

    sql += " ORDER BY company";

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Suppliers error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;