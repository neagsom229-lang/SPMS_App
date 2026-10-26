// backend/src/routes/orders.js
const express = require('express');
const pool = require('../config/postgres');
const { authenticate } = require('../middleware/auth');
const { clearTenantCache } = require('../middleware/cache');

const router = express.Router();

const getTenantId = (req) => {
  if (req.user?.isSuperAdmin) {
    return req.query.tenant_id || req.query.tenantId || null;
  }
  return req.user?.tenantId || null;
};

// ===== GET ALL ORDERS =====
router.get('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;
  const { page = 1, limit = 20, status, search } = req.query;
  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  try {
    let whereClause = ' WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (!isSuperAdmin && tenantId) {
      whereClause += ` AND o.tenant_id = $${paramIndex}`;
      params.push(tenantId);
      paramIndex++;
    }

    if (status) {
      whereClause += ` AND o.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (search) {
      whereClause += ` AND (o.order_no ILIKE $${paramIndex} OR c.name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM tbl_orders o
      LEFT JOIN tbl_customers c ON c.id = o.customer_id AND c.tenant_id = o.tenant_id
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0]?.total || 0, 10);

    const query = `
      SELECT o.*, 
             c.name as customer_name, 
             u.fullname as created_by_name
      FROM tbl_orders o
      LEFT JOIN tbl_customers c ON c.id = o.customer_id AND c.tenant_id = o.tenant_id
      LEFT JOIN tbl_users u ON u.userid = o.user_id
      ${whereClause}
      ORDER BY o.or_id DESC 
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(parseInt(limit, 10), offset);

    const result = await pool.query(query, params);

    res.json({
      orders: result.rows,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        totalPages: Math.ceil(total / parseInt(limit, 10))
      }
    });
  } catch (error) {
    console.error('❌ Get orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// ===== RECENT ORDERS =====
router.get('/recent', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;
  const { limit = 5 } = req.query;

  try {
    let query = `
      SELECT o.*, c.name as customer_name
      FROM tbl_orders o
      LEFT JOIN tbl_customers c ON c.id = o.customer_id
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

// ===== PENDING ORDERS =====
router.get('/pending', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;
  const { limit = 10 } = req.query;

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

    query += ` ORDER BY o.created_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit, 10));

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Get pending orders error:', error);
    res.status(500).json({ error: 'Failed to fetch pending orders' });
  }
});

// ===== GET ORDER BY ID WITH ITEMS =====
router.get('/:id', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;
  const orderId = req.params.id;

  try {
    let orderQuery = `
      SELECT o.*, 
             c.name as customer_name, 
             c.phone as customer_phone, 
             u.fullname as created_by_name
      FROM tbl_orders o
      LEFT JOIN tbl_customers c ON c.id = o.customer_id
      LEFT JOIN tbl_users u ON u.userid = o.user_id
      WHERE o.or_id = $1
    `;
    const params = [orderId];
    if (!isSuperAdmin && tenantId) {
      orderQuery += ` AND o.tenant_id = $2`;
      params.push(tenantId);
    }

    const orderResult = await pool.query(orderQuery, params);
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];

    const itemsResult = await pool.query(
      `SELECT i.*, 
              p.name as name_en, 
              p.name as name, 
              p.name_kh, 
              COALESCE(p.barcode, p.id::text) as product_code
       FROM tbl_order_items i
       LEFT JOIN tbl_products p ON p.id = i.product_id
       WHERE i.order_id = $1`,
      [orderId]
    );

    order.items = itemsResult.rows;
    res.json(order);
  } catch (error) {
    console.error('❌ Get order detail error:', error);
    res.status(500).json({ error: 'Failed to fetch order details' });
  }
});

// ===== CREATE ORDER (POS CHECKOUT) =====
router.post('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return res.status(403).json({ error: 'Tenant context required' });
  }

  const userId = req.user?.userId;
  const { items, discount, payment_method, notes, idempotency_key } = req.body;
  let customer_id = req.body.customer_id;

  if (!items || !Array.isArray(items) || items.length === 0 || items.length > 200) {
    return res.status(400).json({ error: 'At least one item is required' });
  }

  const client = await pool.connect();

  try {
    // Optional customer: walk-in sales have none; a given customer must belong to this tenant
    if (customer_id === undefined || customer_id === null || customer_id === '') {
      customer_id = null;
    } else {
      const customerNum = Number(customer_id);
      if (!Number.isInteger(customerNum) || customerNum < 1) {
        return res.status(400).json({ error: 'Invalid customer' });
      }
      const customerRes = await client.query('SELECT id FROM tbl_customers WHERE id = $1 AND tenant_id = $2', [customerNum, tenantId]);
      if (customerRes.rowCount === 0) {
        return res.status(400).json({ error: 'Customer not found' });
      }
      customer_id = customerNum;
    }
    // 0. Check Idempotency Key
    if (idempotency_key) {
      const existingKeyRes = await client.query(
        `SELECT * FROM tbl_orders WHERE tenant_id = $1 AND idempotency_key = $2`,
        [tenantId, idempotency_key]
      );
      if (existingKeyRes.rows.length > 0) {
        const ord = existingKeyRes.rows[0];
        const itemsRes = await client.query(
          `SELECT i.*, p.name as name_en, p.name as name, p.name_kh 
           FROM tbl_order_items i 
           LEFT JOIN tbl_products p ON p.id = i.product_id 
           WHERE i.order_id = $1`,
          [ord.or_id]
        );
        ord.items = itemsRes.rows;
        client.release();
        return res.status(200).json(ord);
      }
    }

    await client.query('BEGIN');

    let calculatedSubtotal = 0;
    const validatedItems = [];

    // 1. Authoritative DB pricing and inventory check
    for (const item of items) {
      const prodId = item.product_id || item.id;
      if (!prodId || isNaN(Number(prodId))) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Product ID ${prodId} is missing or invalid` });
      }
      const rawQty = item.quantity !== undefined ? item.quantity : item.qty;
        const requestedQty = Number(rawQty);
        if (!Number.isInteger(requestedQty) || requestedQty < 1 || requestedQty > 100000) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Quantity must be a whole number of 1 or more' });
        }

      const stockRes = await client.query(
        `SELECT s.qtyavailable, p.id as product_id, 
                p.name as name_en,
                p.name as product_name,
                p.price,
                p.cost
         FROM tbl_stock s
         JOIN tbl_products p ON p.id = s.productid
         WHERE s.productid = $1 AND s.tenant_id = $2 AND COALESCE(LOWER(p.status), 'active') = 'active'
         FOR UPDATE OF s`,
        [prodId, tenantId]
      );

      if (stockRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `Product ID ${prodId} not found in stock` });
      }

      const row = stockRes.rows[0];
      const available = row.qtyavailable;
      if (available < requestedQty) {
        await client.query('ROLLBACK');
        return res.status(409).json({ 
          error: `Insufficient stock for "${row.product_name}". Requested: ${requestedQty}, Available: ${available}`,
          product_id: prodId,
          available_qty: available
        });
      }

      const unitPrice = Number(row.price) || 0;
      const buyPrice = Number(row.cost) || 0;
      const lineSubtotal = Number((requestedQty * unitPrice).toFixed(2));
      calculatedSubtotal += lineSubtotal;

      validatedItems.push({
        product_id: row.product_id,
        qty: requestedQty,
        unit_price: unitPrice,
        buy_price: buyPrice,
        subtotal: lineSubtotal
      });
    }

    const discountNum = Number(discount || 0);
    if (!Number.isFinite(discountNum) || discountNum < 0 || discountNum > calculatedSubtotal) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Discount must be between 0 and the order subtotal' });
    }
    const finalDiscount = Number(discountNum.toFixed(2));
    const finalTotal = Number(Math.max(0, calculatedSubtotal - finalDiscount).toFixed(2));
    const orderNo = `ORD-${Date.now().toString().slice(-6)}`;
    const method = payment_method || 'Cash';

    // 2. Insert order
    const orderResult = await client.query(
      `INSERT INTO tbl_orders 
        (tenant_id, order_no, customer_id, user_id, total, discount, payment_method, status, notes, idempotency_key, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'Completed', $8, $9, NOW())
       RETURNING *`,
      [tenantId, orderNo, customer_id, userId || null, finalTotal, finalDiscount, method, notes || null, idempotency_key || null]
    );

    const order = orderResult.rows[0];

    // 3. Insert items, decrement tbl_stock, record stock log
    for (const vItem of validatedItems) {
      await client.query(
        `INSERT INTO tbl_order_items 
          (tenant_id, order_id, product_id, qty, unit_price, buy_price, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [tenantId, order.or_id, vItem.product_id, vItem.qty, vItem.unit_price, vItem.buy_price, vItem.subtotal]
      );

      // Decrement authoritative inventory
      await client.query(
        `UPDATE tbl_stock 
         SET qtyinstock = qtyinstock - $1,
             qtyavailable = qtyavailable - $1
         WHERE productid = $2 AND tenant_id = $3`,
        [vItem.qty, vItem.product_id, tenantId]
      );

      // Write audit log
      await client.query(
        `INSERT INTO tbl_stock_log (tenant_id, product_id, change_qty, type, reference_id, notes)
         VALUES ($1, $2, $3, 'SALE', $4, $5)`,
        [tenantId, vItem.product_id, -vItem.qty, order.or_id, `Sale order #${order.order_no} by user ${userId || 'system'}`]
      );
    }

    // 4. Record payment
    await client.query(
      `INSERT INTO tbl_payment (order_id, tenant_id, amount, payment_method, status, created_at)
       VALUES ($1, $2, $3, $4, 'COMPLETED', NOW())`,
      [order.or_id, tenantId, finalTotal, method]
    );

    await client.query('COMMIT');
    clearTenantCache(tenantId);

    // Retrieve full order with items
    const fullOrderRes = await pool.query(
      `SELECT o.*, c.name as customer_name 
       FROM tbl_orders o 
       LEFT JOIN tbl_customers c ON c.id = o.customer_id 
       WHERE o.or_id = $1`,
      [order.or_id]
    );
    const itemsRes = await pool.query(
      `SELECT i.*, p.name as name_en, p.name as name, p.name_kh 
       FROM tbl_order_items i 
       LEFT JOIN tbl_products p ON p.id = i.product_id 
       WHERE i.order_id = $1`,
      [order.or_id]
    );

    const responseOrder = fullOrderRes.rows[0];
    responseOrder.items = itemsRes.rows;

    res.status(201).json(responseOrder);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Create order error:', error);
    res.status(500).json({ error: error.message || 'Failed to create order' });
  } finally {
    client.release();
  }
});

// ===== CANCEL ORDER =====
router.post('/:id/cancel', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const userId = req.user?.userId;
  const orderId = req.params.id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderRes = await client.query(
      `SELECT * FROM tbl_orders WHERE or_id = $1 AND tenant_id = $2 FOR UPDATE`,
      [orderId, tenantId]
    );

    if (orderRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderRes.rows[0];
    if (order.status === 'Refunded' || order.status === 'Cancelled') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Order is already cancelled or refunded' });
    }

    const itemsRes = await client.query(
      `SELECT * FROM tbl_order_items WHERE order_id = $1`,
      [orderId]
    );

    for (const item of itemsRes.rows) {
      const prodId = item.product_id;
      const qty = item.qty || item.quantity;

      // Restore stock in tbl_stock
      await client.query(
        `UPDATE tbl_stock 
         SET qtyinstock = qtyinstock + $1,
             qtyavailable = qtyavailable + $1
         WHERE productid = $2 AND tenant_id = $3`,
        [qty, prodId, tenantId]
      );

      // Audit log for cancel
      await client.query(
        `INSERT INTO tbl_stock_log (tenant_id, product_id, change_qty, type, reference_id, notes)
         VALUES ($1, $2, $3, 'CANCEL', $4, $5)`,
        [tenantId, prodId, qty, orderId, `Cancel order #${orderId} by user ${userId || 'system'}`]
      );
    }

    await client.query(
      `UPDATE tbl_orders SET status = 'Cancelled', updated_at = NOW() WHERE or_id = $1`,
      [orderId]
    );

    await client.query('COMMIT');
    clearTenantCache(tenantId);
    res.json({ success: true, message: 'Order cancelled and stock restored successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Cancel order error:', error);
    res.status(500).json({ error: 'Failed to process order cancellation' });
  } finally {
    client.release();
  }
});

// ===== VOID / REFUND ORDER =====
router.post('/:id/refund', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const userId = req.user?.userId;
  const orderId = req.params.id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderRes = await client.query(
      `SELECT * FROM tbl_orders WHERE or_id = $1 AND tenant_id = $2 FOR UPDATE`,
      [orderId, tenantId]
    );

    if (orderRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderRes.rows[0];
    if (order.status === 'Refunded' || order.status === 'Cancelled') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Order is already refunded or cancelled' });
    }

    const itemsRes = await client.query(
      `SELECT * FROM tbl_order_items WHERE order_id = $1`,
      [orderId]
    );

    for (const item of itemsRes.rows) {
      const prodId = item.product_id;
      const qty = item.qty || item.quantity;

      // Restore stock in tbl_stock
      await client.query(
        `UPDATE tbl_stock 
         SET qtyinstock = qtyinstock + $1,
             qtyavailable = qtyavailable + $1
         WHERE productid = $2 AND tenant_id = $3`,
        [qty, prodId, tenantId]
      );

      // Audit log for refund
      await client.query(
        `INSERT INTO tbl_stock_log (tenant_id, product_id, change_qty, type, reference_id, notes)
         VALUES ($1, $2, $3, 'REFUND', $4, $5)`,
        [tenantId, prodId, qty, orderId, `Refund order #${orderId} by user ${userId || 'system'}`]
      );
    }

    await client.query(
      `UPDATE tbl_orders SET status = 'Refunded' WHERE or_id = $1`,
      [orderId]
    );

    await client.query('COMMIT');
    clearTenantCache(tenantId);
    res.json({ success: true, message: 'Order refunded and stock restored successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Refund order error:', error);
    res.status(500).json({ error: 'Failed to process refund' });
  } finally {
    client.release();
  }
});

// ===== UPDATE ORDER STATUS =====
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
       WHERE or_id = $2 AND tenant_id = $3
       RETURNING *`,
      [status, req.params.id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    clearTenantCache(tenantId);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Update order status error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// ===== DELETE ORDER =====
router.delete('/:id', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);

  try {
    const result = await pool.query(
      'DELETE FROM tbl_orders WHERE or_id = $1 AND tenant_id = $2 RETURNING or_id',
      [req.params.id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    clearTenantCache(tenantId);
    res.status(204).end();
  } catch (error) {
    console.error('❌ Delete order error:', error);
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

module.exports = router;
