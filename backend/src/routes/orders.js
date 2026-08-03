// backend/src/routes/orders.js
const express = require('express');
const pool = require('../config/postgres');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ===== HELPER: Get tenant ID =====
const getTenantId = (req) => {
  return req.user?.tenantId || req.tenantId || req.headers['x-tenant-id'];
};

// ===== GET ALL ORDERS (Only current tenant) =====
router.get('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;
  const { page = 1, limit = 20, status } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let query = `
      SELECT o.*, c.name_en as customer_name, u.fullname as created_by_name
      FROM tbl_orders o
      LEFT JOIN tbl_customers c ON c.id = o.customer_id AND c.tenant_id = o.tenant_id
      LEFT JOIN tbl_users u ON u.userid = o.created_by
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    // ✅ Filter by tenant if not super admin
    if (!isSuperAdmin && tenantId) {
      query += ` AND o.tenant_id = $${paramIndex}`;
      params.push(tenantId);
      paramIndex++;
    }

    if (status) {
      query += ` AND o.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Get total count
    const countQuery = query.replace(
      /SELECT o\.\*, c\.name_en as customer_name, u\.fullname as created_by_name FROM/i,
      'SELECT COUNT(*) as total FROM'
    );
    const countResult = await pool.query(countQuery, params.slice(0, paramIndex - 1));
    const total = parseInt(countResult.rows[0]?.total || 0);

    query += ` ORDER BY o.id DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);

    res.json({
      orders: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ Get orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// ===== GET ORDER BY ID (Only if belongs to tenant) =====
router.get('/:id', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;

  try {
    let query = `
      SELECT o.*, c.name_en as customer_name, u.fullname as created_by_name
      FROM tbl_orders o
      LEFT JOIN tbl_customers c ON c.id = o.customer_id AND c.tenant_id = o.tenant_id
      LEFT JOIN tbl_users u ON u.userid = o.created_by
      WHERE o.id = $1
    `;
    const params = [req.params.id];

    if (!isSuperAdmin && tenantId) {
      query += ` AND o.tenant_id = $2`;
      params.push(tenantId);
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Get order items
    let itemsQuery = `
      SELECT oi.*, p.name_en as product_name, p.name_kh as product_name_kh
      FROM order_items oi
      LEFT JOIN tbl_products p ON p.id = oi.product_id AND p.tenant_id = oi.tenant_id
      WHERE oi.order_id = $1
    `;
    const itemsParams = [req.params.id];

    if (!isSuperAdmin && tenantId) {
      itemsQuery += ` AND oi.tenant_id = $2`;
      itemsParams.push(tenantId);
    }

    const items = await pool.query(itemsQuery, itemsParams);

    res.json({
      ...result.rows[0],
      items: items.rows
    });
  } catch (error) {
    console.error('❌ Get order error:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// ===== CREATE ORDER (With tenant_id) =====
router.post('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  
  if (!tenantId) {
    return res.status(403).json({ error: 'Tenant context required' });
  }

  const userId = req.user?.userId;
  const { customer_id, items, total_amount, payment_method, notes } = req.body;

  if (!customer_id || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Customer and items are required' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Create order with tenant_id
    const orderResult = await client.query(
      `INSERT INTO tbl_orders 
       (tenant_id, customer_id, total_amount, status, payment_method, notes, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [tenantId, customer_id, total_amount || 0, 'PENDING', payment_method || 'CASH', notes || null, userId]
    );

    const order = orderResult.rows[0];

    // Add order items with tenant_id
    for (const item of items) {
      await client.query(
        `INSERT INTO order_items 
         (tenant_id, order_id, product_id, quantity, price, total)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tenantId, order.id, item.product_id, item.quantity, item.price, item.quantity * item.price]
      );

      // Update stock
      await client.query(
        `UPDATE tbl_products 
         SET qty_instock = qty_instock - $1,
             updated_at = NOW()
         WHERE id = $2 AND tenant_id = $3`,
        [item.quantity, item.product_id, tenantId]
      );
    }

    await client.query('COMMIT');

    // Get full order with items
    const fullOrder = await pool.query(
      `SELECT o.*, c.name_en as customer_name
       FROM tbl_orders o
       LEFT JOIN tbl_customers c ON c.id = o.customer_id AND c.tenant_id = o.tenant_id
       WHERE o.id = $1 AND o.tenant_id = $2`,
      [order.id, tenantId]
    );

    const orderItems = await pool.query(
      `SELECT oi.*, p.name_en as product_name
       FROM order_items oi
       LEFT JOIN tbl_products p ON p.id = oi.product_id AND p.tenant_id = oi.tenant_id
       WHERE oi.order_id = $1 AND oi.tenant_id = $2`,
      [order.id, tenantId]
    );

    res.status(201).json({
      ...fullOrder.rows[0],
      items: orderItems.rows
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  } finally {
    client.release();
  }
});

// ===== UPDATE ORDER STATUS (Only if belongs to tenant) =====
router.patch('/:id/status', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  try {
    const result = await pool.query(
      `UPDATE tbl_orders 
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3
       RETURNING *`,
      [status, req.params.id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Update order status error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// ===== DELETE ORDER (Only if belongs to tenant) =====
router.delete('/:id', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);

  try {
    const result = await pool.query(
      'DELETE FROM tbl_orders WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [req.params.id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.status(204).end();
  } catch (error) {
    console.error('❌ Delete order error:', error);
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

module.exports = router;