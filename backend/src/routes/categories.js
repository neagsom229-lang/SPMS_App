// backend/src/routes/categories.js
const express = require('express');
const db = require('../config/postgres');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ===== GET ALL CATEGORIES =====
router.get('/', authenticate, async (req, res) => {
  try {
    const isSuperAdmin = req.user.isSuperAdmin || false;
    const tenantId = req.user.tenantId;

    let sql = 'SELECT * FROM tbl_categories';
    const params = [];

    if (!isSuperAdmin) {
      if (!tenantId) {
        return res.status(403).json({ error: 'Tenant ID required' });
      }
      sql += ' WHERE tenant_id = $1';
      params.push(tenantId);
    }

    sql += ' ORDER BY id';

    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Categories error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
