// backend/src/routes/tenants.js
const express = require('express');
const db = require('../config/postgres');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');

const router = express.Router();

// ===== GET ALL TENANTS =====
router.get('/', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        t.*,
        COUNT(DISTINCT u.userid) as user_count,
        COUNT(DISTINCT p.id) as product_count,
        COUNT(DISTINCT o.id) as order_count,
        COALESCE(SUM(o.total_amount), 0) as total_revenue
      FROM tenants t
      LEFT JOIN tbl_users u ON u.tenant_id = t.id
      LEFT JOIN tbl_products p ON p.tenant_id = t.id
      LEFT JOIN tbl_orders o ON o.tenant_id = t.id
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Get tenants error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;