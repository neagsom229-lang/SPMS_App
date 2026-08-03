// backend/src/routes/activity-logs.js
const express = require('express');
const pool = require('../config/postgres');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const getTenantId = (req) => {
  return req.user?.tenantId || req.tenantId || req.headers['x-tenant-id'];
};

// ===== GET ACTIVITY LOGS =====
router.get('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;
  const { limit = 200, search, action, table_name, user_id } = req.query;

  try {
    let query = `
      SELECT al.*, u.username 
      FROM tbl_activity_logs al
      LEFT JOIN tbl_users u ON u.userid = al.user_id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (!isSuperAdmin && tenantId) {
      query += ` AND al.tenant_id = $${paramIndex}`;
      params.push(tenantId);
      paramIndex++;
    }

    if (search) {
      query += ` AND (u.username ILIKE $${paramIndex} OR al.action ILIKE $${paramIndex} OR al.table_name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (action) {
      query += ` AND al.action = $${paramIndex}`;
      params.push(action);
      paramIndex++;
    }

    if (table_name) {
      query += ` AND al.table_name = $${paramIndex}`;
      params.push(table_name);
      paramIndex++;
    }

    if (user_id) {
      query += ` AND al.user_id = $${paramIndex}`;
      params.push(user_id);
      paramIndex++;
    }

    query += ` ORDER BY al.action_date DESC LIMIT $${paramIndex}`;
    params.push(Number(limit));

    const result = await pool.query(query, params);

    // Get stats
    let statsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT al.user_id) as unique_users,
        COUNT(DISTINCT al.action) as unique_actions,
        COUNT(DISTINCT al.table_name) as unique_tables
      FROM tbl_activity_logs al
      WHERE 1=1
    `;
    const statsParams = [];

    if (!isSuperAdmin && tenantId) {
      statsQuery += ` AND al.tenant_id = $1`;
      statsParams.push(tenantId);
    }

    const statsResult = await pool.query(statsQuery, statsParams);

    res.json({
      logs: result.rows,
      stats: {
        total: parseInt(statsResult.rows[0]?.total || 0),
        uniqueUsers: parseInt(statsResult.rows[0]?.unique_users || 0),
        uniqueActions: parseInt(statsResult.rows[0]?.unique_actions || 0),
        uniqueTables: parseInt(statsResult.rows[0]?.unique_tables || 0),
      }
    });
  } catch (err) {
    console.error('❌ Activity logs error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;