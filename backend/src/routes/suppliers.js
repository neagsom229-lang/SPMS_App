// backend/src/routes/suppliers.js
const express = require('express');
const db = require('../config/postgres');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ===== GET ALL SUPPLIERS =====
router.get('/', authenticate, async (req, res) => {
  const { search } = req.query;
  const token = req.headers.authorization?.split(' ')[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
  
  const isSuperAdmin = decoded.isSuperAdmin || false;
  const tenantId = decoded.tenantId;

  let sql = "SELECT * FROM tbl_suppliers WHERE status = 'Active'";
  const params = [];

  if (!isSuperAdmin && tenantId) {
    sql += " AND tenant_id = $1";
    params.push(tenantId);
    let paramIndex = 2;
    if (search) {
      sql += ` AND (company ILIKE $${paramIndex} OR first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex} OR phone ILIKE $${paramIndex} OR e_mail ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
    }
  } else if (search) {
    sql += ` AND (company ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1 OR phone ILIKE $1 OR e_mail ILIKE $1)`;
    params.push(`%${search}%`);
  }

  sql += " ORDER BY company";

  try {
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Suppliers error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;