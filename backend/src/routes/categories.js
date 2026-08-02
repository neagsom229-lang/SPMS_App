// backend/src/routes/categories.js
const express = require('express');
const db = require('../config/postgres');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ===== GET ALL CATEGORIES =====
router.get('/', authenticate, async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
  
  const isSuperAdmin = decoded.isSuperAdmin || false;
  const tenantId = decoded.tenantId;

  try {
    let sql = 'SELECT * FROM tbl_categories';
    const params = [];

    if (!isSuperAdmin && tenantId) {
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