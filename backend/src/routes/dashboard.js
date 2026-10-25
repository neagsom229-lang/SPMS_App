// backend/src/routes/dashboard.js
const express = require('express');
const pool = require('../config/postgres');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const getTenantId = (req) => {
  return req.user?.tenantId || req.tenantId || req.headers['x-tenant-id'];
};

// ===== SYSTEM STATS FOR SUPER ADMIN =====
router.get('/system/stats', authenticate, async (req, res) => {
  const isSuperAdmin = req.user?.isSuperAdmin || false;
  
  if (!isSuperAdmin) {
    return res.status(403).json({ error: 'Access denied. Super admin only.' });
  }

  try {
    let totalTenants = 0;
    let totalUsers = 0;
    let totalProducts = 0;
    let totalOrders = 0;
    let totalRevenue = 0;
    let totalCustomers = 0;

    try {
      const tenantCheck = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'tenants' OR table_name = 'tbl_tenants'
        )
      `);
      if (tenantCheck.rows[0].exists) {
        const tName = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_name IN ('tenants', 'tbl_tenants') LIMIT 1`);
        const tableName = tName.rows[0].table_name;
        const tenantResult = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
        totalTenants = parseInt(tenantResult.rows[0]?.count || 0);
      }
    } catch (e) {
      console.warn('Tenants table query failed:', e.message);
    }

    try {
      const userResult = await pool.query('SELECT COUNT(*) as count FROM tbl_users');
      totalUsers = parseInt(userResult.rows[0]?.count || 0);
    } catch (e) {
      console.warn('Users query failed:', e.message);
    }

    try {
      const productResult = await pool.query("SELECT COUNT(*) as count FROM tbl_products WHERE status = 'Active'");
      totalProducts = parseInt(productResult.rows[0]?.count || 0);
    } catch (e) {
      console.warn('Products query failed:', e.message);
    }

    try {
      const orderResult = await pool.query("SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total FROM tbl_orders WHERE status = 'Completed'");
      totalOrders = parseInt(orderResult.rows[0]?.count || 0);
      totalRevenue = parseFloat(orderResult.rows[0]?.total || 0);
    } catch (e) {
      console.warn('Orders query failed:', e.message);
    }

    try {
      const customerResult = await pool.query("SELECT COUNT(*) as count FROM tbl_customers WHERE status = 'Active'");
      totalCustomers = parseInt(customerResult.rows[0]?.count || 0);
    } catch (e) {
      console.warn('Customers query failed:', e.message);
    }

    res.json({
      totalTenants,
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue,
      totalCustomers
    });
  } catch (error) {
    console.error('❌ System stats error:', error);
    res.json({
      totalTenants: 0,
      totalUsers: 0,
      totalProducts: 0,
      totalOrders: 0,
      totalRevenue: 0,
      totalCustomers: 0
    });
  }
});

// ===== DASHBOARD STATS =====
router.get('/stats', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;

  try {
    if (isSuperAdmin) {
      const results = await Promise.all([
        pool.query("SELECT COUNT(*) as count FROM tbl_products WHERE status = 'Active'"),
        pool.query("SELECT COUNT(*) as count FROM tbl_orders WHERE status = 'Completed'"),
        pool.query("SELECT COUNT(*) as count FROM tbl_customers WHERE status = 'Active'"),
        pool.query("SELECT COUNT(*) as count FROM tbl_suppliers WHERE status = 'Active'"),
        pool.query("SELECT COALESCE(SUM(total), 0) as total FROM tbl_orders WHERE status = 'Completed'"),
        pool.query("SELECT COUNT(*) as count FROM tbl_stock s JOIN tbl_products p ON s.productid = p.id WHERE s.qtyavailable <= p.qty_alert AND p.status = 'Active'"),
        pool.query("SELECT COUNT(*) as count FROM tbl_orders WHERE status = 'Pending'"),
        pool.query("SELECT COUNT(*) as count FROM tbl_orders WHERE created_at >= NOW() - INTERVAL '7 days' AND status = 'Completed'"),
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
      pool.query("SELECT COUNT(*) as count FROM tbl_products WHERE tenant_id = $1 AND status = 'Active'", [tenantId]),
      pool.query("SELECT COUNT(*) as count FROM tbl_orders WHERE tenant_id = $1 AND status = 'Completed'", [tenantId]),
      pool.query("SELECT COUNT(*) as count FROM tbl_customers WHERE tenant_id = $1 AND status = 'Active'", [tenantId]),
      pool.query("SELECT COUNT(*) as count FROM tbl_suppliers WHERE tenant_id = $1 AND status = 'Active'", [tenantId]),
      pool.query("SELECT COALESCE(SUM(total), 0) as total FROM tbl_orders WHERE tenant_id = $1 AND status = 'Completed'", [tenantId]),
      pool.query("SELECT COUNT(*) as count FROM tbl_stock s JOIN tbl_products p ON s.productid = p.id WHERE p.tenant_id = $1 AND s.qtyavailable <= p.qty_alert AND p.status = 'Active'", [tenantId]),
      pool.query("SELECT COUNT(*) as count FROM tbl_orders WHERE tenant_id = $1 AND status = 'Pending'", [tenantId]),
      pool.query("SELECT COUNT(*) as count FROM tbl_orders WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '7 days' AND status = 'Completed'", [tenantId]),
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

// ===== SALES SUMMARY FOR ADVANCED DASHBOARD =====
router.get('/sales-summary', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;
  const { range = '30d' } = req.query;

  let intervalClause = "NOW() - INTERVAL '30 days'";
  if (range === 'today') intervalClause = "DATE_TRUNC('day', NOW())";
  else if (range === '7d') intervalClause = "NOW() - INTERVAL '7 days'";
  else if (range === 'month') intervalClause = "DATE_TRUNC('month', NOW())";

  try {
    let tenantFilterOrders = "WHERE o.status = 'Completed'";
    let tenantFilterProducts = "WHERE p.status = 'Active'";
    let params = [];

    if (!isSuperAdmin && tenantId) {
      tenantFilterOrders = "WHERE o.status = 'Completed' AND o.tenant_id = $1";
      tenantFilterProducts = "WHERE p.status = 'Active' AND p.tenant_id = $1";
      params.push(tenantId);
    }

    // 1. KPIs & Revenue
    const kpiQuery = `
      SELECT 
        COALESCE(SUM(o.total), 0) as net_revenue,
        COUNT(o.or_id) as total_orders,
        COALESCE(AVG(o.total), 0) as avg_order_value
      FROM tbl_orders o
      ${tenantFilterOrders} AND o.created_at >= ${range === 'today' ? "DATE_TRUNC('day', NOW())" : intervalClause}
    `;
    const kpiRes = await pool.query(kpiQuery, params);

    // 2. Gross profit & units sold
    const profitQuery = `
      SELECT 
        COALESCE(SUM(i.qty), 0) as units_sold,
        COALESCE(SUM((i.unit_price - i.buy_price) * i.qty), 0) as gross_profit
      FROM tbl_order_items i
      JOIN tbl_orders o ON o.or_id = i.order_id
      ${tenantFilterOrders} AND o.created_at >= ${range === 'today' ? "DATE_TRUNC('day', NOW())" : intervalClause}
    `;
    const profitRes = await pool.query(profitQuery, params);

    // 3. Inventory valuation
    const stockValQuery = `
      SELECT 
        COUNT(p.id) as total_skus,
        COALESCE(SUM(s.qtyavailable * p.price * 0.7), 0) as stock_value_cost,
        COALESCE(SUM(s.qtyavailable * p.price), 0) as stock_value_retail,
        COUNT(CASE WHEN s.qtyavailable <= p.qty_alert AND s.qtyavailable > 0 THEN 1 END) as low_stock_count,
        COUNT(CASE WHEN s.qtyavailable = 0 THEN 1 END) as out_of_stock_count
      FROM tbl_products p
      JOIN tbl_stock s ON s.productid = p.id
      ${tenantFilterProducts}
    `;
    const stockValRes = await pool.query(stockValQuery, params);

    // 4. Top 10 Products
    const topProdQuery = `
      SELECT 
        p.name as name_en, p.name_kh,
        SUM(i.qty) as total_qty,
        SUM(i.subtotal) as total_revenue
      FROM tbl_order_items i
      JOIN tbl_orders o ON o.or_id = i.order_id
      JOIN tbl_products p ON p.id = i.product_id
      ${tenantFilterOrders} AND o.created_at >= ${range === 'today' ? "DATE_TRUNC('day', NOW())" : intervalClause}
      GROUP BY p.id, p.name, p.name_kh
      ORDER BY total_revenue DESC
      LIMIT 10
    `;
    const topProdRes = await pool.query(topProdQuery, params);

    const kpi = kpiRes.rows[0];
    const profit = profitRes.rows[0];
    const stockVal = stockValRes.rows[0];

    res.json({
      net_revenue: parseFloat(kpi.net_revenue || 0),
      total_orders: parseInt(kpi.total_orders || 0),
      avg_order_value: parseFloat(kpi.avg_order_value || 0),
      units_sold: parseInt(profit.units_sold || 0),
      gross_profit: parseFloat(profit.gross_profit || 0),
      profit_margin: kpi.net_revenue > 0 ? parseFloat(((profit.gross_profit / kpi.net_revenue) * 100).toFixed(2)) : 0,
      inventory: {
        total_skus: parseInt(stockVal.total_skus || 0),
        stock_value_cost: parseFloat(stockVal.stock_value_cost || 0),
        stock_value_retail: parseFloat(stockVal.stock_value_retail || 0),
        low_stock_count: parseInt(stockVal.low_stock_count || 0),
        out_of_stock_count: parseInt(stockVal.out_of_stock_count || 0),
      },
      top_products: topProdRes.rows
    });
  } catch (error) {
    console.error('❌ Sales summary error:', error);
    res.status(500).json({ error: 'Failed to fetch sales summary' });
  }
});

// ===== RECENT ORDERS =====
router.get('/recent', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;
  const { limit = 5 } = req.query;

  try {
    let query = `
      SELECT o.*, c.name as customer_name, u.fullname as created_by_name
      FROM tbl_orders o
      LEFT JOIN tbl_customers c ON c.id = o.customer_id
      LEFT JOIN tbl_users u ON u.userid = o.user_id
      WHERE 1=1
    `;
    const params = [];

    if (!isSuperAdmin && tenantId) {
      query += ` AND o.tenant_id = $1`;
      params.push(tenantId);
    }

    query += ` ORDER BY o.created_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit, 10));

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
      SELECT o.*, c.name as customer_name
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
