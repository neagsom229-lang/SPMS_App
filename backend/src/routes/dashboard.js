// backend/src/routes/dashboard.js
const express = require('express');
const pool = require('../../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ===== TEST ROUTE =====
router.get('/test', (req, res) => {
  res.json({ message: '✅ Dashboard route is working' });
});

// ===== GET DASHBOARD STATS =====
router.get('/stats', authenticate, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const isSuperAdmin = req.user?.isSuperAdmin || false;
    
    console.log('📊 Dashboard stats request:', { 
      userId: req.user?.userId, 
      tenantId, 
      isSuperAdmin 
    });

    // Get counts
    let productQuery = 'SELECT COUNT(*) as count FROM tbl_products';
    let orderQuery = 'SELECT COUNT(*) as count FROM tbl_orders';
    let customerQuery = 'SELECT COUNT(*) as count FROM tbl_customers';
    let supplierQuery = 'SELECT COUNT(*) as count FROM tbl_suppliers';
    let revenueQuery = 'SELECT COALESCE(SUM(total_amount), 0) as total FROM tbl_orders';
    let lowStockQuery = 'SELECT COUNT(*) as count FROM tbl_products WHERE qty_instock <= qty_alert';
    let pendingQuery = 'SELECT COUNT(*) as count FROM tbl_orders WHERE status = $1';
    let recentQuery = 'SELECT COUNT(*) as count FROM tbl_orders WHERE created_at >= NOW() - INTERVAL \'7 days\'';

    const params = [];
    const pendingParams = ['PENDING'];

    if (!isSuperAdmin && tenantId) {
      productQuery += ' WHERE tenant_id = $1';
      orderQuery += ' WHERE tenant_id = $1';
      customerQuery += ' WHERE tenant_id = $1';
      supplierQuery += ' WHERE tenant_id = $1';
      revenueQuery += ' WHERE tenant_id = $1';
      lowStockQuery += ' AND tenant_id = $1';
      pendingQuery += ' AND tenant_id = $2';
      recentQuery += ' AND tenant_id = $1';
      params.push(tenantId);
      pendingParams.push(tenantId);
    } else if (!isSuperAdmin && !tenantId) {
      return res.json({
        totalProducts: 0,
        totalOrders: 0,
        totalCustomers: 0,
        totalSuppliers: 0,
        totalRevenue: 0,
        lowStock: 0,
        pendingOrders: 0,
        recentOrders: 0
      });
    }

    // Execute all queries
    const [
      productsResult,
      ordersResult,
      customersResult,
      suppliersResult,
      revenueResult,
      lowStockResult,
      pendingResult,
      recentResult
    ] = await Promise.all([
      pool.query(productQuery, params),
      pool.query(orderQuery, params),
      pool.query(customerQuery, params),
      pool.query(supplierQuery, params),
      pool.query(revenueQuery, params),
      pool.query(lowStockQuery, params),
      pool.query(pendingQuery, pendingParams),
      pool.query(recentQuery, params)
    ]);

    res.json({
      totalProducts: parseInt(productsResult.rows[0]?.count || 0),
      totalOrders: parseInt(ordersResult.rows[0]?.count || 0),
      totalCustomers: parseInt(customersResult.rows[0]?.count || 0),
      totalSuppliers: parseInt(suppliersResult.rows[0]?.count || 0),
      totalRevenue: parseFloat(revenueResult.rows[0]?.total || 0),
      lowStock: parseInt(lowStockResult.rows[0]?.count || 0),
      pendingOrders: parseInt(pendingResult.rows[0]?.count || 0),
      recentOrders: parseInt(recentResult.rows[0]?.count || 0)
    });
  } catch (error) {
    console.error('❌ Get stats error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch dashboard stats', 
      details: error.message 
    });
  }
});

// ===== GET RECENT ORDERS =====
router.get('/recent', authenticate, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const isSuperAdmin = req.user?.isSuperAdmin || false;
    const { limit = 5 } = req.query;

    let query = `
      SELECT o.*, c.name_en as customer_name, u.fullname as created_by_name
      FROM tbl_orders o
      LEFT JOIN tbl_customers c ON c.id = o.customer_id
      LEFT JOIN tbl_users u ON u.userid = o.created_by
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (!isSuperAdmin && tenantId) {
      query += ` WHERE o.tenant_id = $${paramIndex}`;
      params.push(tenantId);
      paramIndex++;
    } else if (!isSuperAdmin && !tenantId) {
      return res.json([]);
    }
    
    query += ` ORDER BY o.created_at DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Get recent orders error:', error);
    res.status(500).json({ error: 'Failed to fetch recent orders' });
  }
});

// ===== GET LOW STOCK PRODUCTS =====
router.get('/low-stock', authenticate, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const isSuperAdmin = req.user?.isSuperAdmin || false;

    let query = 'SELECT * FROM tbl_products WHERE qty_instock <= qty_alert';
    const params = [];
    
    if (!isSuperAdmin && tenantId) {
      query += ' AND tenant_id = $1';
      params.push(tenantId);
    } else if (!isSuperAdmin && !tenantId) {
      return res.json([]);
    }
    
    query += ' ORDER BY qty_instock ASC LIMIT 10';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Get low stock error:', error);
    res.status(500).json({ error: 'Failed to fetch low stock products' });
  }
});

// ===== GET PENDING ORDERS =====
router.get('/pending', authenticate, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const isSuperAdmin = req.user?.isSuperAdmin || false;

    let query = `
      SELECT o.*, c.name_en as customer_name
      FROM tbl_orders o
      LEFT JOIN tbl_customers c ON c.id = o.customer_id
      WHERE o.status = 'PENDING'
    `;
    const params = [];
    let paramIndex = 1;
    
    if (!isSuperAdmin && tenantId) {
      query += ` AND o.tenant_id = $${paramIndex}`;
      params.push(tenantId);
      paramIndex++;
    } else if (!isSuperAdmin && !tenantId) {
      return res.json([]);
    }
    
    query += ` ORDER BY o.created_at DESC LIMIT $${paramIndex}`;
    params.push(10);

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Get pending orders error:', error);
    res.status(500).json({ error: 'Failed to fetch pending orders' });
  }
});

module.exports = router;