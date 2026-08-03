// backend/src/routes/dashboard.js
const express = require('express');
const pool = require('../config/postgres');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const getTenantId = (req) => {
  return req.user?.tenantId || req.tenantId || req.headers['x-tenant-id'];
};

// ===== DASHBOARD STATS =====
router.get('/stats', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;

  try {
    let productQuery = 'SELECT COUNT(*) as count FROM tbl_products WHERE status = $1';
    let orderQuery = 'SELECT COUNT(*) as count FROM tbl_orders';
    let customerQuery = 'SELECT COUNT(*) as count FROM tbl_customers WHERE status = $1';
    let supplierQuery = 'SELECT COUNT(*) as count FROM tbl_suppliers WHERE status = $1';
    // ✅ FIX: Use amount_us instead of total_amount
    let revenueQuery = 'SELECT COALESCE(SUM(amount_us), 0) as total FROM tbl_orders';
    let lowStockQuery = 'SELECT COUNT(*) as count FROM tbl_products WHERE qty_instock <= qty_alert AND status = $1';
    let pendingQuery = 'SELECT COUNT(*) as count FROM tbl_orders WHERE status = $1';
    let recentQuery = 'SELECT COUNT(*) as count FROM tbl_orders WHERE created_at >= NOW() - INTERVAL \'7 days\'';

    const baseParams = ['Active'];
    const pendingParams = ['Pending'];

    if (isSuperAdmin) {
      const results = await Promise.all([
        pool.query(productQuery, baseParams),
        pool.query(orderQuery, []),
        pool.query(customerQuery, baseParams),
        pool.query(supplierQuery, baseParams),
        pool.query(revenueQuery, []),
        pool.query(lowStockQuery, baseParams),
        pool.query(pendingQuery, pendingParams),
        pool.query(recentQuery, []),
      ]);

      return res.json({
        totalProducts: parseInt(results[0].rows[0]?.count || 0),
        totalOrders: parseInt(results[1].rows[0]?.count || 0),
        totalCustomers: parseInt(results[2].rows[0]?.count || 0),
        totalSuppliers: parseInt(results[3].rows[0]?.count || 0),
        totalRevenue: parseFloat(results[4].rows[0]?.total || 0),
        lowStock: parseInt(results[5].rows[0]?.count || 0),
        pendingOrders: parseInt(results[6].rows[0]?.count || 0),
        recentOrders: parseInt(results[7].rows[0]?.count || 0),
      });
    }

    if (!tenantId) {
      return res.json({
        totalProducts: 0,
        totalOrders: 0,
        totalCustomers: 0,
        totalSuppliers: 0,
        totalRevenue: 0,
        lowStock: 0,
        pendingOrders: 0,
        recentOrders: 0,
      });
    }

    const results = await Promise.all([
      pool.query(productQuery + ' AND tenant_id = $2', [...baseParams, tenantId]),
      pool.query(orderQuery + ' WHERE tenant_id = $1', [tenantId]),
      pool.query(customerQuery + ' AND tenant_id = $2', [...baseParams, tenantId]),
      pool.query(supplierQuery + ' AND tenant_id = $2', [...baseParams, tenantId]),
      // ✅ FIX: Use amount_us instead of total_amount
      pool.query(revenueQuery + ' WHERE tenant_id = $1', [tenantId]),
      pool.query(lowStockQuery + ' AND tenant_id = $2', [...baseParams, tenantId]),
      pool.query(pendingQuery + ' AND tenant_id = $2', ['Pending', tenantId]),
      pool.query(recentQuery + ' WHERE tenant_id = $1', [tenantId]),
    ]);

    res.json({
      totalProducts: parseInt(results[0].rows[0]?.count || 0),
      totalOrders: parseInt(results[1].rows[0]?.count || 0),
      totalCustomers: parseInt(results[2].rows[0]?.count || 0),
      totalSuppliers: parseInt(results[3].rows[0]?.count || 0),
      totalRevenue: parseFloat(results[4].rows[0]?.total || 0),
      lowStock: parseInt(results[5].rows[0]?.count || 0),
      pendingOrders: parseInt(results[6].rows[0]?.count || 0),
      recentOrders: parseInt(results[7].rows[0]?.count || 0),
    });
  } catch (error) {
    console.error('❌ Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// ===== RECENT ORDERS =====
router.get('/recent', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;
  const { limit = 5 } = req.query;

  try {
    let query = `
      SELECT o.*, c.name_en as customer_name, u.fullname as created_by_name
      FROM tbl_orders o
      LEFT JOIN tbl_customers c ON c.id = o.customer_id
      LEFT JOIN tbl_users u ON u.userid = o.created_by
      WHERE 1=1
    `;
    const params = [];

    if (!isSuperAdmin && tenantId) {
      query += ` AND o.tenant_id = $1`;
      params.push(tenantId);
    }

    query += ` ORDER BY o.created_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Get recent orders error:', error);
    res.status(500).json({ error: 'Failed to fetch recent orders' });
  }
});

// ===== LOW STOCK =====
router.get('/low-stock', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;

  try {
    let query = `
      SELECT p.*, s.qtyavailable, s.qtyreserved 
      FROM tbl_products p
      JOIN tbl_stock s ON s.productid = p.id
      WHERE p.status = 'Active' AND s.qtyavailable <= p.qty_alert
    `;
    const params = [];

    if (!isSuperAdmin && tenantId) {
      query += ` AND p.tenant_id = $1`;
      params.push(tenantId);
    }

    query += ' ORDER BY s.qtyavailable ASC LIMIT 10';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Get low stock error:', error);
    res.status(500).json({ error: 'Failed to fetch low stock' });
  }
});

// ===== PENDING ORDERS =====
router.get('/pending', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;

  try {
    let query = `
      SELECT o.*, c.name_en as customer_name
      FROM tbl_orders o
      LEFT JOIN tbl_customers c ON c.id = o.customer_id
      WHERE o.status = 'Pending'
    `;
    const params = [];

    if (!isSuperAdmin && tenantId) {
      query += ` AND o.tenant_id = $1`;
      params.push(tenantId);
    }

    query += ' ORDER BY o.created_at DESC LIMIT 10';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Get pending orders error:', error);
    res.status(500).json({ error: 'Failed to fetch pending orders' });
  }
});

module.exports = router;