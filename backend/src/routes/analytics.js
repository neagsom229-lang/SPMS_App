// backend/src/routes/analytics.js
const express = require('express');
const pool = require('../config/postgres');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const getTenantId = (req) => {
  return req.user?.tenantId || req.tenantId || req.headers['x-tenant-id'];
};

// ===== GET ANALYTICS STATS =====
router.get('/stats', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;

  try {
    let queries = {};

    if (isSuperAdmin) {
      queries = {
        totalCustomers: 'SELECT COUNT(*) as count FROM tbl_customers WHERE status = $1',
        totalProducts: 'SELECT COUNT(*) as count FROM tbl_products WHERE status = $1',
        totalOrders: 'SELECT COUNT(*) as count FROM tbl_orders',
        totalRevenue: 'SELECT COALESCE(SUM(amount_us), 0) as revenue FROM tbl_orders',
        lowStock: 'SELECT COUNT(*) as count FROM tbl_stock WHERE qtyavailable <= 5',
        pendingOrders: 'SELECT COUNT(*) as count FROM tbl_orders WHERE status = $1',
      };
      const params = ['Active'];
      
      const results = await Promise.all([
        pool.query(queries.totalCustomers, params),
        pool.query(queries.totalProducts, params),
        pool.query(queries.totalOrders, []),
        pool.query(queries.totalRevenue, []),
        pool.query(queries.lowStock, []),
        pool.query(queries.pendingOrders, params),
      ]);

      return res.json({
        totalCustomers: parseInt(results[0].rows[0]?.count || 0),
        totalProducts: parseInt(results[1].rows[0]?.count || 0),
        totalOrders: parseInt(results[2].rows[0]?.count || 0),
        totalRevenue: parseFloat(results[3].rows[0]?.revenue || 0),
        lowStock: parseInt(results[4].rows[0]?.count || 0),
        pendingOrders: parseInt(results[5].rows[0]?.count || 0),
      });
    }

    if (!tenantId) {
      return res.json({
        totalCustomers: 0,
        totalProducts: 0,
        totalOrders: 0,
        totalRevenue: 0,
        lowStock: 0,
        pendingOrders: 0,
      });
    }

    const results = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM tbl_customers WHERE tenant_id = $1 AND status = $2', [tenantId, 'Active']),
      pool.query('SELECT COUNT(*) as count FROM tbl_products WHERE tenant_id = $1 AND status = $2', [tenantId, 'Active']),
      pool.query('SELECT COUNT(*) as count FROM tbl_orders WHERE tenant_id = $1', [tenantId]),
      pool.query('SELECT COALESCE(SUM(amount_us), 0) as revenue FROM tbl_orders WHERE tenant_id = $1', [tenantId]),
      pool.query('SELECT COUNT(*) as count FROM tbl_stock s JOIN tbl_products p ON s.productid = p.id WHERE p.tenant_id = $1 AND s.qtyavailable <= 5', [tenantId]),
      pool.query('SELECT COUNT(*) as count FROM tbl_orders WHERE tenant_id = $1 AND status = $2', [tenantId, 'Pending']),
    ]);

    res.json({
      totalCustomers: parseInt(results[0].rows[0]?.count || 0),
      totalProducts: parseInt(results[1].rows[0]?.count || 0),
      totalOrders: parseInt(results[2].rows[0]?.count || 0),
      totalRevenue: parseFloat(results[3].rows[0]?.revenue || 0),
      lowStock: parseInt(results[4].rows[0]?.count || 0),
      pendingOrders: parseInt(results[5].rows[0]?.count || 0),
    });
  } catch (error) {
    console.error('❌ Analytics stats error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics stats' });
  }
});

// ===== MONTHLY REVENUE =====
router.get('/monthly-revenue', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;

  try {
    let query = `
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM') as month,
        COALESCE(SUM(amount_us), 0) as revenue
      FROM tbl_orders
      WHERE status = 'COMPLETED'
    `;
    const params = [];

    if (!isSuperAdmin && tenantId) {
      query += ` AND tenant_id = $1`;
      params.push(tenantId);
    }

    query += ` GROUP BY TO_CHAR(created_at, 'YYYY-MM') ORDER BY month DESC LIMIT 12`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Monthly revenue error:', error);
    res.status(500).json({ error: 'Failed to fetch monthly revenue' });
  }
});

// ===== TOP PRODUCTS =====
router.get('/top-products', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;
  const { limit = 10 } = req.query;

  try {
    let query = `
      SELECT 
        p.id,
        p.name_en,
        p.name_kh,
        p.saleout_price,
        COALESCE(SUM(oi.quantity), 0) as total_sold,
        COALESCE(SUM(oi.quantity * oi.price), 0) as total_revenue
      FROM tbl_products p
      LEFT JOIN order_items oi ON oi.product_id = p.id
      LEFT JOIN tbl_orders o ON o.id = oi.order_id AND o.status = 'COMPLETED'
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (!isSuperAdmin && tenantId) {
      query += ` AND p.tenant_id = $${paramIndex}`;
      params.push(tenantId);
      paramIndex++;
    }

    query += ` GROUP BY p.id, p.name_en, p.name_kh, p.saleout_price
               ORDER BY total_sold DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Top products error:', error);
    res.status(500).json({ error: 'Failed to fetch top products' });
  }
});

module.exports = router;