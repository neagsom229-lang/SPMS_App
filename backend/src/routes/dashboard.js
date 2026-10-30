// backend/src/routes/dashboard.js
const express = require('express');
const pool = require('../config/postgres');
const { authenticate, getScope } = require('../middleware/auth');
const { REVENUE_STATUSES } = require('../constants/sales');

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
      const orderResult = await pool.query("SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total FROM tbl_orders WHERE status = ANY($1)", [REVENUE_STATUSES]);
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
        pool.query("SELECT COUNT(*) as count FROM tbl_orders WHERE status = ANY($1)", [REVENUE_STATUSES]),
        pool.query("SELECT COUNT(*) as count FROM tbl_customers WHERE status = 'Active'"),
        pool.query("SELECT COUNT(*) as count FROM tbl_suppliers WHERE status = 'Active'"),
        pool.query("SELECT COALESCE(SUM(total), 0) as total FROM tbl_orders WHERE status = ANY($1)", [REVENUE_STATUSES]),
        pool.query("SELECT COUNT(*) as count FROM tbl_stock s JOIN tbl_products p ON s.productid = p.id WHERE s.qtyavailable <= p.qty_alert AND p.status = 'Active'"),
        pool.query("SELECT COUNT(*) as count FROM tbl_orders WHERE status = 'Pending'"),
        pool.query("SELECT COUNT(*) as count FROM tbl_orders WHERE created_at >= NOW() - INTERVAL '7 days' AND status = ANY($1)", [REVENUE_STATUSES]),
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
      pool.query("SELECT COUNT(*) as count FROM tbl_orders WHERE tenant_id = $1 AND status = ANY($2)", [tenantId, REVENUE_STATUSES]),
      pool.query("SELECT COUNT(*) as count FROM tbl_customers WHERE tenant_id = $1 AND status = 'Active'", [tenantId]),
      pool.query("SELECT COUNT(*) as count FROM tbl_suppliers WHERE tenant_id = $1 AND status = 'Active'", [tenantId]),
      pool.query("SELECT COALESCE(SUM(total), 0) as total FROM tbl_orders WHERE tenant_id = $1 AND status = ANY($2)", [tenantId, REVENUE_STATUSES]),
      pool.query("SELECT COUNT(*) as count FROM tbl_stock s JOIN tbl_products p ON s.productid = p.id WHERE p.tenant_id = $1 AND s.qtyavailable <= p.qty_alert AND p.status = 'Active'", [tenantId]),
      pool.query("SELECT COUNT(*) as count FROM tbl_orders WHERE tenant_id = $1 AND status = 'Pending'", [tenantId]),
      pool.query("SELECT COUNT(*) as count FROM tbl_orders WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '7 days' AND status = ANY($2)", [tenantId, REVENUE_STATUSES]),
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
  const scope = getScope(req, res);
  if (!scope) return;
  const tenantId = scope.tenantId;
  const { range = '30d', from, to } = req.query;

  let currStart, currEnd = "NOW()", prevStart, prevEnd;

  if (range === 'today') {
    currStart = "DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Phnom_Penh') AT TIME ZONE 'Asia/Phnom_Penh' AT TIME ZONE 'UTC'";
    currEnd = "NOW()";
    prevStart = "DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Phnom_Penh' - INTERVAL '1 day') AT TIME ZONE 'Asia/Phnom_Penh' AT TIME ZONE 'UTC'";
    prevEnd = "DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Phnom_Penh') AT TIME ZONE 'Asia/Phnom_Penh' AT TIME ZONE 'UTC'";
  } else if (range === '7d') {
    currStart = "NOW() - INTERVAL '7 days'";
    currEnd = "NOW()";
    prevStart = "NOW() - INTERVAL '14 days'";
    prevEnd = "NOW() - INTERVAL '7 days'";
  } else if (range === '30d') {
    currStart = "NOW() - INTERVAL '30 days'";
    currEnd = "NOW()";
    prevStart = "NOW() - INTERVAL '60 days'";
    prevEnd = "NOW() - INTERVAL '30 days'";
  } else if (range === 'month') {
    currStart = "DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Phnom_Penh') AT TIME ZONE 'Asia/Phnom_Penh' AT TIME ZONE 'UTC'";
    currEnd = "NOW()";
    prevStart = "DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Phnom_Penh' - INTERVAL '1 month') AT TIME ZONE 'Asia/Phnom_Penh' AT TIME ZONE 'UTC'";
    prevEnd = "DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Phnom_Penh') AT TIME ZONE 'Asia/Phnom_Penh' AT TIME ZONE 'UTC'";
  } else if (range === 'custom') {
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to query parameters are required for custom range' });
    }
    const dFrom = new Date(from);
    const dTo = new Date(to);
    if (isNaN(dFrom.getTime()) || isNaN(dTo.getTime()) || dFrom > dTo) {
      return res.status(400).json({ error: 'Invalid date range' });
    }
    const diffDays = (dTo - dFrom) / (1000 * 60 * 60 * 24);
    if (diffDays > 366) {
      return res.status(400).json({ error: 'Custom range cannot exceed 366 days' });
    }
    const durationMs = dTo.getTime() - dFrom.getTime();
    const dFromPrev = new Date(dFrom.getTime() - durationMs);
    
    currStart = `'${dFrom.toISOString()}'::timestamptz`;
    currEnd = `'${new Date(dTo.getTime() + 86400000 - 1).toISOString()}'::timestamptz`;
    prevStart = `'${dFromPrev.toISOString()}'::timestamptz`;
    prevEnd = `'${dFrom.toISOString()}'::timestamptz`;
  } else {
    return res.status(400).json({ error: 'Invalid range parameter' });
  }

  try {
    const revenueStatuses = REVENUE_STATUSES;

    // 1. Current KPIs
    const kpiQuery = `
      SELECT 
        COALESCE(SUM(i.subtotal - COALESCE(i.refunded_amount, 0)), 0) as net_revenue,
        COUNT(DISTINCT o.or_id) as total_orders,
        COALESCE(AVG(o.total), 0) as avg_order_value,
        COALESCE(SUM(i.qty - COALESCE(i.refunded_qty, 0)), 0) as units_sold,
        COALESCE(SUM((i.unit_price - COALESCE(i.buy_price, 0)) * (i.qty - COALESCE(i.refunded_qty, 0))), 0) as gross_profit
      FROM tbl_orders o
      JOIN tbl_order_items i ON i.order_id = o.or_id
      WHERE ($1::int IS NULL OR o.tenant_id = $1)
        AND o.status = ANY($2::text[])
        AND o.created_at >= ${currStart} AND o.created_at <= ${currEnd}
    `;
    const kpiRes = await pool.query(kpiQuery, [tenantId, revenueStatuses]);

    // 2. Previous KPIs
    const prevKpiQuery = `
      SELECT 
        COALESCE(SUM(i.subtotal - COALESCE(i.refunded_amount, 0)), 0) as net_revenue,
        COUNT(DISTINCT o.or_id) as total_orders,
        COALESCE(AVG(o.total), 0) as avg_order_value,
        COALESCE(SUM(i.qty - COALESCE(i.refunded_qty, 0)), 0) as units_sold,
        COALESCE(SUM((i.unit_price - COALESCE(i.buy_price, 0)) * (i.qty - COALESCE(i.refunded_qty, 0))), 0) as gross_profit
      FROM tbl_orders o
      JOIN tbl_order_items i ON i.order_id = o.or_id
      WHERE ($1::int IS NULL OR o.tenant_id = $1)
        AND o.status = ANY($2::text[])
        AND o.created_at >= ${prevStart} AND o.created_at < ${prevEnd}
    `;
    const prevKpiRes = await pool.query(prevKpiQuery, [tenantId, revenueStatuses]);

    // 3. Timeseries
    let timeseriesQuery = '';
    if (range === 'today') {
      timeseriesQuery = `
        SELECT 
          to_char(bucket AT TIME ZONE 'Asia/Phnom_Penh', 'YYYY-MM-DD HH24:00') as bucket,
          COALESCE(SUM(sub.revenue), 0) as revenue,
          COALESCE(SUM(sub.orders), 0) as orders,
          COALESCE(SUM(sub.units), 0) as units
        FROM generate_series(
          DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Phnom_Penh'),
          DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Phnom_Penh') + INTERVAL '23 hours',
          INTERVAL '1 hour'
        ) bucket
        LEFT JOIN (
          SELECT 
            DATE_TRUNC('hour', o.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Phnom_Penh') as h,
            SUM(i.subtotal - COALESCE(i.refunded_amount, 0)) as revenue,
            COUNT(DISTINCT o.or_id) as orders,
            SUM(i.qty - COALESCE(i.refunded_qty, 0)) as units
          FROM tbl_orders o
          JOIN tbl_order_items i ON i.order_id = o.or_id
          WHERE ($1::int IS NULL OR o.tenant_id = $1)
            AND o.status = ANY($2::text[])
            AND o.created_at >= ${currStart} AND o.created_at <= ${currEnd}
          GROUP BY h
        ) sub ON DATE_TRUNC('hour', bucket) = sub.h
        GROUP BY bucket
        ORDER BY bucket
      `;
    } else {
      timeseriesQuery = `
        SELECT 
          to_char(bucket AT TIME ZONE 'Asia/Phnom_Penh', 'YYYY-MM-DD') as bucket,
          COALESCE(SUM(sub.revenue), 0) as revenue,
          COALESCE(SUM(sub.orders), 0) as orders,
          COALESCE(SUM(sub.units), 0) as units
        FROM generate_series(
          (${currStart})::timestamptz AT TIME ZONE 'Asia/Phnom_Penh',
          (${currEnd})::timestamptz AT TIME ZONE 'Asia/Phnom_Penh',
          INTERVAL '1 day'
        ) bucket
        LEFT JOIN (
          SELECT 
            DATE_TRUNC('day', o.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Phnom_Penh') as d,
            SUM(i.subtotal - COALESCE(i.refunded_amount, 0)) as revenue,
            COUNT(DISTINCT o.or_id) as orders,
            SUM(i.qty - COALESCE(i.refunded_qty, 0)) as units
          FROM tbl_orders o
          JOIN tbl_order_items i ON i.order_id = o.or_id
          WHERE ($1::int IS NULL OR o.tenant_id = $1)
            AND o.status = ANY($2::text[])
            AND o.created_at >= ${currStart} AND o.created_at <= ${currEnd}
          GROUP BY d
        ) sub ON bucket::date = sub.d::date
        GROUP BY bucket
        ORDER BY bucket
      `;
    }
    const timeseriesRes = await pool.query(timeseriesQuery, [tenantId, revenueStatuses]);

    // 4. By category
    const catQuery = `
      SELECT 
        COALESCE(c.name, 'Uncategorized') as name,
        COALESCE(SUM(i.subtotal - COALESCE(i.refunded_amount, 0)), 0) as revenue,
        COALESCE(SUM(i.qty - COALESCE(i.refunded_qty, 0)), 0) as units
      FROM tbl_order_items i
      JOIN tbl_orders o ON o.or_id = i.order_id
      JOIN tbl_products p ON p.id = i.product_id
      LEFT JOIN tbl_categories c ON c.id = p.category_id
      WHERE ($1::int IS NULL OR o.tenant_id = $1)
        AND o.status = ANY($2::text[])
        AND o.created_at >= ${currStart} AND o.created_at <= ${currEnd}
      GROUP BY c.name
      ORDER BY revenue DESC
    `;
    const catRes = await pool.query(catQuery, [tenantId, revenueStatuses]);

    // 5. By payment method
    const pmQuery = `
      SELECT 
        COALESCE(o.payment_method, 'Cash') as method,
        COALESCE(SUM(i.subtotal - COALESCE(i.refunded_amount, 0)), 0) as revenue,
        COUNT(DISTINCT o.or_id) as orders
      FROM tbl_orders o
      JOIN tbl_order_items i ON i.order_id = o.or_id
      WHERE ($1::int IS NULL OR o.tenant_id = $1)
        AND o.status = ANY($2::text[])
        AND o.created_at >= ${currStart} AND o.created_at <= ${currEnd}
      GROUP BY o.payment_method
      ORDER BY revenue DESC
    `;
    const pmRes = await pool.query(pmQuery, [tenantId, revenueStatuses]);

    // 6. By source (POS vs ONLINE)
    const sourceQuery = `
      SELECT 
        COALESCE(NULLIF(o.source, ''), 'POS') as source,
        COALESCE(SUM(i.subtotal - COALESCE(i.refunded_amount, 0)), 0) as revenue,
        COUNT(DISTINCT o.or_id) as orders
      FROM tbl_orders o
      JOIN tbl_order_items i ON i.order_id = o.or_id
      WHERE ($1::int IS NULL OR o.tenant_id = $1)
        AND o.status = ANY($2::text[])
        AND o.created_at >= ${currStart} AND o.created_at <= ${currEnd}
      GROUP BY COALESCE(NULLIF(o.source, ''), 'POS')
      ORDER BY revenue DESC
    `;
    const sourceRes = await pool.query(sourceQuery, [tenantId, revenueStatuses]);

    // 7. Refunds
    const refundQuery = `
      SELECT 
        (
          SELECT COALESCE(SUM(o.total), 0)
          FROM tbl_orders o
          WHERE ($1::int IS NULL OR o.tenant_id = $1)
            AND o.status = 'Refunded'
            AND o.created_at >= ${currStart} AND o.created_at <= ${currEnd}
        ) + (
          SELECT COALESCE(SUM(i.refunded_amount), 0)
          FROM tbl_orders o
          JOIN tbl_order_items i ON i.order_id = o.or_id
          WHERE ($1::int IS NULL OR o.tenant_id = $1)
            AND o.status = ANY($2::text[])
            AND i.refunded_amount > 0
            AND o.created_at >= ${currStart} AND o.created_at <= ${currEnd}
        ) as amount,
        (
          SELECT COUNT(DISTINCT o.or_id)
          FROM tbl_orders o
          WHERE ($1::int IS NULL OR o.tenant_id = $1)
            AND (o.status = 'Refunded' OR EXISTS (SELECT 1 FROM tbl_order_items i WHERE i.order_id = o.or_id AND i.refunded_amount > 0))
            AND o.created_at >= ${currStart} AND o.created_at <= ${currEnd}
        ) as count
    `;
    const refundRes = await pool.query(refundQuery, [tenantId, revenueStatuses]);

    // 8. Open online orders
    const openOnlineQuery = `
      SELECT COUNT(*) as count
      FROM tbl_orders o
      WHERE ($1::int IS NULL OR o.tenant_id = $1)
        AND o.source = 'ONLINE'
        AND o.status IN ('Pending', 'Confirmed', 'Preparing')
    `;
    const openOnlineRes = await pool.query(openOnlineQuery, [tenantId]);

    // 9. Alerts
    const lowStockQuery = `
      SELECT p.name, s.qtyavailable, p.qty_alert
      FROM tbl_stock s
      JOIN tbl_products p ON p.id = s.productid
      WHERE ($1::int IS NULL OR p.tenant_id = $1)
        AND p.status = 'Active'
        AND s.qtyavailable <= p.qty_alert AND s.qtyavailable > 0
    `;
    const outStockQuery = `
      SELECT p.name
      FROM tbl_stock s
      JOIN tbl_products p ON p.id = s.productid
      WHERE ($1::int IS NULL OR p.tenant_id = $1)
        AND p.status = 'Active'
        AND s.qtyavailable = 0
    `;
    const pendingOnlineQuery = `
      SELECT order_no, created_at
      FROM tbl_orders o
      WHERE ($1::int IS NULL OR o.tenant_id = $1)
        AND o.source = 'ONLINE'
        AND o.status IN ('Pending', 'Confirmed', 'Preparing')
        AND o.created_at < NOW() - INTERVAL '30 minutes'
    `;
    const [lowStockRes, outStockRes, pendingOnlineRes] = await Promise.all([
      pool.query(lowStockQuery, [tenantId]),
      pool.query(outStockQuery, [tenantId]),
      pool.query(pendingOnlineQuery, [tenantId])
    ]);

    const alerts = [];
    lowStockRes.rows.forEach(r => {
      alerts.push({ type: 'LOW_STOCK', message: `Low stock alert for "${r.name}": ${r.qtyavailable} remaining (alert threshold ${r.qty_alert})` });
    });
    outStockRes.rows.forEach(r => {
      alerts.push({ type: 'OUT_OF_STOCK', message: `Out of stock: "${r.name}"` });
    });
    pendingOnlineRes.rows.forEach(r => {
      alerts.push({ type: 'PENDING_ONLINE_ORDER', message: `Online order #${r.order_no} has been pending for over 30 minutes` });
    });

    // 10. Inventory valuation
    const stockValQuery = `
      SELECT 
        COUNT(p.id) as total_skus,
        COALESCE(SUM(s.qtyavailable * p.price * 0.7), 0) as stock_value_cost,
        COALESCE(SUM(s.qtyavailable * p.price), 0) as stock_value_retail,
        COUNT(CASE WHEN s.qtyavailable <= p.qty_alert AND s.qtyavailable > 0 THEN 1 END) as low_stock_count,
        COUNT(CASE WHEN s.qtyavailable = 0 THEN 1 END) as out_of_stock_count
      FROM tbl_products p
      JOIN tbl_stock s ON s.productid = p.id
      WHERE ($1::int IS NULL OR p.tenant_id = $1) AND p.status = 'Active'
    `;
    const stockValRes = await pool.query(stockValQuery, [tenantId]);

    // 11. Top Products
    const topProdQuery = `
      SELECT 
        p.name as name_en, p.name as name, p.name_kh,
        SUM(i.qty - COALESCE(i.refunded_qty, 0)) as total_qty,
        SUM(i.subtotal - COALESCE(i.refunded_amount, 0)) as total_revenue
      FROM tbl_order_items i
      JOIN tbl_orders o ON o.or_id = i.order_id
      JOIN tbl_products p ON p.id = i.product_id
      WHERE ($1::int IS NULL OR o.tenant_id = $1)
        AND o.status = ANY($2::text[])
        AND o.created_at >= ${currStart} AND o.created_at <= ${currEnd}
      GROUP BY p.id, p.name, p.name_kh
      ORDER BY total_revenue DESC
      LIMIT 10
    `;
    const topProdRes = await pool.query(topProdQuery, [tenantId, revenueStatuses]);

    const kpi = kpiRes.rows[0];
    const prevKpi = prevKpiRes.rows[0];
    const stockVal = stockValRes.rows[0];
    const refundData = refundRes.rows[0];

    const netRevenue = parseFloat(kpi.net_revenue || 0);
    const totalOrders = parseInt(kpi.total_orders || 0);
    const avgOrderValue = parseFloat(kpi.avg_order_value || 0);
    const unitsSold = parseInt(kpi.units_sold || 0);
    const grossProfit = parseFloat(kpi.gross_profit || 0);
    const profitMargin = netRevenue > 0 ? parseFloat(((grossProfit / netRevenue) * 100).toFixed(2)) : 0;

    const prevNetRevenue = parseFloat(prevKpi.net_revenue || 0);
    const prevTotalOrders = parseInt(prevKpi.total_orders || 0);
    const prevAvgOrderValue = parseFloat(prevKpi.avg_order_value || 0);
    const prevUnitsSold = parseInt(prevKpi.units_sold || 0);
    const prevGrossProfit = parseFloat(prevKpi.gross_profit || 0);
    const prevProfitMargin = prevNetRevenue > 0 ? parseFloat(((prevGrossProfit / prevNetRevenue) * 100).toFixed(2)) : 0;

    const calcChange = (curr, prev) => prev === 0 ? null : parseFloat((((curr - prev) / prev) * 100).toFixed(2));

    res.json({
      net_revenue: netRevenue,
      total_orders: totalOrders,
      avg_order_value: avgOrderValue,
      units_sold: unitsSold,
      gross_profit: grossProfit,
      profit_margin: profitMargin,
      previous: {
        net_revenue: prevNetRevenue,
        total_orders: prevTotalOrders,
        avg_order_value: prevAvgOrderValue,
        units_sold: prevUnitsSold,
        gross_profit: prevGrossProfit,
        profit_margin: prevProfitMargin
      },
      change_pct: {
        net_revenue: calcChange(netRevenue, prevNetRevenue),
        total_orders: calcChange(totalOrders, prevTotalOrders),
        avg_order_value: calcChange(avgOrderValue, prevAvgOrderValue),
        units_sold: calcChange(unitsSold, prevUnitsSold),
        gross_profit: calcChange(grossProfit, prevGrossProfit),
        profit_margin: calcChange(profitMargin, prevProfitMargin)
      },
      timeseries: timeseriesRes.rows.map(r => ({
        bucket: r.bucket,
        revenue: parseFloat(r.revenue || 0),
        orders: parseInt(r.orders || 0),
        units: parseInt(r.units || 0)
      })),
      by_category: catRes.rows.map(r => ({
        name: r.name,
        revenue: parseFloat(r.revenue || 0),
        units: parseInt(r.units || 0)
      })),
      by_payment_method: pmRes.rows.map(r => ({
        method: r.method,
        revenue: parseFloat(r.revenue || 0),
        orders: parseInt(r.orders || 0)
      })),
      by_source: sourceRes.rows.map(r => ({
        source: r.source,
        revenue: parseFloat(r.revenue || 0),
        orders: parseInt(r.orders || 0)
      })),
      refunds: {
        count: parseInt(refundData.count || 0),
        amount: parseFloat(refundData.amount || 0)
      },
      open_online_orders: parseInt(openOnlineRes.rows[0]?.count || 0),
      alerts,
      inventory: {
        total_skus: parseInt(stockVal.total_skus || 0),
        stock_value_cost: parseFloat(stockVal.stock_value_cost || 0),
        stock_value_retail: parseFloat(stockVal.stock_value_retail || 0),
        low_stock_count: parseInt(stockVal.low_stock_count || 0),
        out_of_stock_count: parseInt(stockVal.out_of_stock_count || 0),
      },
      top_products: topProdRes.rows.map(r => ({
        name_en: r.name_en || r.name,
        name_kh: r.name_kh,
        total_qty: parseInt(r.total_qty || 0),
        total_revenue: parseFloat(r.total_revenue || 0)
      }))
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
