// backend/src/routes/orders.js
const express = require('express');
const pool = require('../config/postgres');
const { authenticate } = require('../middleware/auth');
const { clearTenantCache } = require('../middleware/cache');
const { BusinessError } = require('../lib/errors');

const router = express.Router();

const getTenantId = (req, res) => {
  if (req.user?.isSuperAdmin) {
    return req.query.tenant_id || req.query.tenantId || null;
  }
  if (!req.user?.tenantId) {
    if (res) res.status(403).json({ error: 'Tenant context required' });
    return null;
  }
  return req.user.tenantId;
};

// ===== GET ALL ORDERS =====
router.get('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req, res);
  if (!tenantId && !req.user?.isSuperAdmin) return;
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
  const tenantId = getTenantId(req, res);
  if (!tenantId && !req.user?.isSuperAdmin) return;
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
  const tenantId = getTenantId(req, res);
  if (!tenantId && !req.user?.isSuperAdmin) return;
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

// ===== GET ONLINE ORDERS COUNT PER STATUS =====
router.get('/online/count', authenticate, async (req, res) => {
  const tenantId = getTenantId(req, res);
  if (!tenantId && !req.user?.isSuperAdmin) return;
  if (!tenantId) {
    return res.status(403).json({ error: 'Tenant context required' });
  }

  try {
    const countRes = await pool.query(
      `SELECT status, COUNT(*) as count 
       FROM tbl_orders 
       WHERE tenant_id = $1 AND source = 'ONLINE' 
       GROUP BY status`,
      [tenantId]
    );

    const counts = {
      Pending: 0,
      Confirmed: 0,
      Preparing: 0,
      Ready: 0,
      Completed: 0,
      Cancelled: 0
    };

    for (const row of countRes.rows) {
      if (counts.hasOwnProperty(row.status) || row.status) {
        counts[row.status] = parseInt(row.count, 10);
      }
    }

    res.json(counts);
  } catch (error) {
    console.error('❌ Get online orders count error:', error);
    res.status(500).json({ error: 'Failed to fetch online order counts' });
  }
});

// ===== GET ONLINE ORDERS =====
router.get('/online', authenticate, async (req, res) => {
  const tenantId = getTenantId(req, res);
  if (!tenantId && !req.user?.isSuperAdmin) return;
  if (!tenantId) {
    return res.status(403).json({ error: 'Tenant context required' });
  }

  const { status, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  try {
    let whereClause = ' WHERE o.tenant_id = $1 AND o.source = \'ONLINE\'';
    const params = [tenantId];
    let paramIndex = 2;

    if (status) {
      whereClause += ` AND o.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM tbl_orders o
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0]?.total || 0, 10);

    const query = `
      SELECT o.or_id, o.order_no, o.total, o.discount, o.status, o.payment_method,
             o.source, o.customer_name, o.customer_phone, o.delivery_type,
             o.delivery_address, o.notes, o.tracking_code, o.created_at,
             c.name as customer_name_rel
      FROM tbl_orders o
      LEFT JOIN tbl_customers c ON c.id = o.customer_id
      ${whereClause}
      ORDER BY o.or_id DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(parseInt(limit, 10), offset);

    const result = await pool.query(query, params);
    const orders = result.rows;

    for (const ord of orders) {
      if (!ord.customer_name && ord.customer_name_rel) {
        ord.customer_name = ord.customer_name_rel;
      }
      const itemsRes = await pool.query(
        `SELECT i.qty, i.unit_price, i.subtotal, p.name as product_name, p.name as name
         FROM tbl_order_items i
         LEFT JOIN tbl_products p ON p.id = i.product_id
         WHERE i.order_id = $1`,
        [ord.or_id]
      );
      ord.items = itemsRes.rows;
    }

    res.json({
      orders,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        totalPages: Math.ceil(total / parseInt(limit, 10))
      }
    });
  } catch (error) {
    console.error('❌ Get online orders error:', error);
    res.status(500).json({ error: 'Failed to fetch online orders' });
  }
});

// ===== GET ORDER BY ID WITH ITEMS =====
router.get('/:id', authenticate, async (req, res) => {
  const tenantId = getTenantId(req, res);
  if (!tenantId && !req.user?.isSuperAdmin) return;
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

async function getNextOrderNo(client, tenantId, prefix = 'ORD') {
  await client.query(
    `INSERT INTO tenant_order_counters (tenant_id, last_seq) VALUES ($1, 0) ON CONFLICT (tenant_id) DO NOTHING`,
    [tenantId]
  );
  const res = await client.query(
    `UPDATE tenant_order_counters SET last_seq = last_seq + 1 WHERE tenant_id = $1 RETURNING last_seq`,
    [tenantId]
  );
  const seq = res.rows[0].last_seq;
  return `${prefix}-${String(seq).padStart(5, '0')}`;
}

// ===== CREATE ORDER (POS CHECKOUT) =====
router.post('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req, res);
  if (!tenantId && !req.user?.isSuperAdmin) return;
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
    if (customer_id === undefined || customer_id === null || customer_id === '') {
      customer_id = null;
    } else {
      const customerNum = Number(customer_id);
      if (!Number.isInteger(customerNum) || customerNum < 1) {
        client.release();
        return res.status(400).json({ error: 'Invalid customer' });
      }
      const customerRes = await client.query('SELECT id FROM tbl_customers WHERE id = $1 AND tenant_id = $2', [customerNum, tenantId]);
      if (customerRes.rowCount === 0) {
        client.release();
        return res.status(400).json({ error: 'Customer not found' });
      }
      customer_id = customerNum;
    }

    // 0. Check Idempotency Key (tenant-scoped)
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

    // Aggregate cart lines by product_id
    const aggregatedMap = new Map();
    for (const item of items) {
      const prodId = Number(item.product_id || item.id);
      const rawQty = Number(item.quantity !== undefined ? item.quantity : item.qty);
      if (!prodId || isNaN(prodId) || !Number.isInteger(rawQty) || rawQty < 1 || rawQty > 100000) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(400).json({ error: 'Invalid product ID or quantity' });
      }
      aggregatedMap.set(prodId, (aggregatedMap.get(prodId) || 0) + rawQty);
    }

    // Sort product IDs ascending before locking to prevent deadlocks
    const sortedProductIds = Array.from(aggregatedMap.keys()).sort((a, b) => a - b);

    let calculatedSubtotal = 0;
    const validatedItems = [];

    // 1. Authoritative DB pricing and inventory check with sorted locks
    for (const prodId of sortedProductIds) {
      const requestedQty = aggregatedMap.get(prodId);

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
        client.release();
        return res.status(409).json({ error: `Product ID ${prodId} not found in stock` });
      }

      const row = stockRes.rows[0];
      const available = row.qtyavailable;
      if (available < requestedQty) {
        await client.query('ROLLBACK');
        client.release();
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
      client.release();
      return res.status(400).json({ error: 'Discount must be between 0 and the order subtotal' });
    }
    const finalDiscount = Number(discountNum.toFixed(2));
    const finalTotal = Number(Math.max(0, calculatedSubtotal - finalDiscount).toFixed(2));
    const orderNo = await getNextOrderNo(client, tenantId, 'ORD');
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

    // 3. Insert items, atomic stock decrement, record stock log
    for (const vItem of validatedItems) {
      await client.query(
        `INSERT INTO tbl_order_items 
          (tenant_id, order_id, product_id, qty, unit_price, buy_price, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [tenantId, order.or_id, vItem.product_id, vItem.qty, vItem.unit_price, vItem.buy_price, vItem.subtotal]
      );

      const updateStockRes = await client.query(
        `UPDATE tbl_stock 
         SET qtyinstock = qtyinstock - $1,
             qtyavailable = qtyavailable - $1
         WHERE productid = $2 AND tenant_id = $3 AND qtyavailable >= $1
         RETURNING qtyavailable`,
        [vItem.qty, vItem.product_id, tenantId]
      );

      if (updateStockRes.rowCount === 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(409).json({ error: `Insufficient stock during atomic update for product ID ${vItem.product_id}` });
      }

      await client.query(
        `INSERT INTO tbl_stock_log (tenant_id, product_id, change_qty, type, reference_id, notes)
         VALUES ($1, $2, $3, 'SALE', $4, $5)`,
        [tenantId, vItem.product_id, -vItem.qty, order.or_id, `Sale order #${order.order_no} by user ${userId || 'system'}`]
      );
    }

    await client.query(
      `INSERT INTO tbl_payment (order_id, tenant_id, amount, payment_method, status, created_at)
       VALUES ($1, $2, $3, $4, 'COMPLETED', NOW())`,
      [order.or_id, tenantId, finalTotal, method]
    );

    await client.query('COMMIT');
    clearTenantCache(tenantId);

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

    client.release();
    res.status(201).json(responseOrder);
  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    console.error('❌ Create order error:', error);
    if (error.code === '23505') {
      return res.status(200).json({ error: 'Idempotency conflict / duplicate order' });
    }
    res.status(500).json({ error: error.message || 'Failed to create order' });
  }
});

async function reverseOrder(client, order, type, userId, reason) {
  const orderId = order.or_id;
  const tenantId = order.tenant_id;

  if (['Refunded', 'Cancelled', 'Voided'].includes(order.status)) {
    throw new BusinessError(`Order is already ${order.status.toLowerCase()}`, 409);
  }

  const itemsRes = await client.query(
    `SELECT * FROM tbl_order_items WHERE order_id = $1`,
    [orderId]
  );

  for (const item of itemsRes.rows) {
    const prodId = item.product_id;
    const qty = item.qty || item.quantity;

    const stockRes = await client.query(
      `UPDATE tbl_stock 
       SET qtyinstock = qtyinstock + $1,
           qtyavailable = qtyavailable + $1
       WHERE productid = $2 AND tenant_id = $3
       RETURNING productid`,
      [qty, prodId, tenantId]
    );

    if (stockRes.rowCount === 0) {
      throw new BusinessError(`Stock record not found for product id ${prodId}`, 409);
    }

    await client.query(
      `INSERT INTO tbl_stock_log (tenant_id, product_id, change_qty, type, reference_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, prodId, qty, type, orderId, `${type} order #${order.order_no || orderId} by user ${userId || 'system'}${reason ? ': ' + reason : ''}`]
    );
  }

  const paymentStatusMap = {
    'REFUND': 'REFUNDED',
    'CANCEL': 'CANCELLED',
    'VOID': 'VOIDED'
  };
  const payStatus = paymentStatusMap[type] || 'REFUNDED';

  await client.query(
    `UPDATE tbl_payment SET status = $1 WHERE order_id = $2 AND tenant_id = $3`,
    [payStatus, orderId, tenantId]
  );

  const newStatusMap = {
    'REFUND': 'Refunded',
    'CANCEL': 'Cancelled',
    'VOID': 'Voided'
  };
  const newStatus = newStatusMap[type];

  if (type === 'VOID') {
    await client.query(
      `UPDATE tbl_orders 
       SET status = $1, voided_at = NOW(), voided_by = $2, void_reason = $3, updated_at = NOW() 
       WHERE or_id = $4 AND tenant_id = $5`,
      [newStatus, userId, reason, orderId, tenantId]
    );
    await client.query(
      `INSERT INTO tbl_activity_logs (user_id, action, target_table, target_id, tenant_id, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [userId || 1, 'VOID_ORDER', 'tbl_orders', orderId, tenantId]
    );
  } else {
    await client.query(
      `UPDATE tbl_orders SET status = $1, updated_at = NOW() WHERE or_id = $2 AND tenant_id = $3`,
      [newStatus, orderId, tenantId]
    );
    await client.query(
      `INSERT INTO tbl_activity_logs (user_id, action, target_table, target_id, tenant_id, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [userId || 1, `${type}_ORDER`, 'tbl_orders', orderId, tenantId]
    );
  }
}

// ===== CANCEL ORDER =====
router.post('/:id/cancel', authenticate, async (req, res) => {
  const tenantId = getTenantId(req, res);
  if (!tenantId && !req.user?.isSuperAdmin) return;
  const userId = req.user?.userId;
  const orderId = req.params.id;

  if (!/^[1-9]\d{0,9}$/.test(String(orderId))) {
    return res.status(400).json({ error: 'Invalid order ID format' });
  }

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
    await reverseOrder(client, order, 'CANCEL', userId, req.body.reason);

    await client.query('COMMIT');
    clearTenantCache(tenantId);
    res.json({ success: true, message: 'Order cancelled and stock restored successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof BusinessError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('❌ Cancel order error:', error);
    res.status(500).json({ error: error.message || 'Failed to process order cancellation' });
  } finally {
    client.release();
  }
});

// ===== REFUND ORDER =====
router.post('/:id/refund', authenticate, async (req, res) => {
  const tenantId = getTenantId(req, res);
  if (!tenantId && !req.user?.isSuperAdmin) return;
  const userId = req.user?.userId;
  const orderId = req.params.id;

  if (!/^[1-9]\d{0,9}$/.test(String(orderId))) {
    return res.status(400).json({ error: 'Invalid order ID format' });
  }

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
    await reverseOrder(client, order, 'REFUND', userId, req.body.reason);

    await client.query('COMMIT');
    clearTenantCache(tenantId);
    res.json({ success: true, message: 'Order refunded and stock restored successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof BusinessError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('❌ Refund order error:', error);
    res.status(500).json({ error: error.message || 'Failed to process refund' });
  } finally {
    client.release();
  }
});

// ===== UPDATE ORDER STATUS =====
router.patch('/:id/status', authenticate, async (req, res) => {
  const tenantId = getTenantId(req, res);
  if (!tenantId && !req.user?.isSuperAdmin) return;
  const userId = req.user?.userId;
  const orderId = req.params.id;
  const { status: newStatus } = req.body;

  if (!/^[1-9]\d{0,9}$/.test(String(orderId))) {
    return res.status(400).json({ error: 'Invalid order ID format' });
  }

  if (!newStatus || !['Pending', 'Confirmed', 'Preparing', 'Ready', 'Completed', 'Cancelled'].includes(newStatus)) {
    return res.status(400).json({ error: 'A valid status is required' });
  }

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
    const currentStatus = order.status;

    const allowedTransitions = {
      'Pending': ['Confirmed', 'Cancelled'],
      'Confirmed': ['Preparing', 'Cancelled'],
      'Preparing': ['Ready', 'Cancelled'],
      'Ready': ['Completed', 'Cancelled']
    };

    const allowed = allowedTransitions[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ 
        error: `Invalid status transition from ${currentStatus} to ${newStatus}`, 
        current_status: currentStatus 
      });
    }

    if (newStatus === 'Cancelled') {
      await reverseOrder(client, order, 'CANCEL', userId, 'Status changed to Cancelled');
    }

    if (newStatus === 'Completed' && (order.payment_method || '').toLowerCase() === 'cash') {
      const payCheck = await client.query('SELECT id FROM tbl_payment WHERE order_id = $1 AND tenant_id = $2', [orderId, tenantId]);
      if (payCheck.rowCount === 0) {
        await client.query(
          `INSERT INTO tbl_payment (order_id, tenant_id, amount, payment_method, status, created_at)
           VALUES ($1, $2, $3, $4, 'COMPLETED', NOW())`,
          [orderId, tenantId, order.total, order.payment_method || 'Cash']
        );
      }
    }

    if (newStatus !== 'Cancelled') {
      await client.query(
        `UPDATE tbl_orders 
         SET status = $1, updated_at = NOW()
         WHERE or_id = $2 AND tenant_id = $3`,
        [newStatus, orderId, tenantId]
      );
    }

    const updateRes = await client.query(
      `SELECT * FROM tbl_orders WHERE or_id = $1 AND tenant_id = $2`,
      [orderId, tenantId]
    );

    await client.query('COMMIT');
    clearTenantCache(tenantId);

    const updatedOrder = updateRes.rows[0];
    const itemsRes = await client.query(
      `SELECT i.qty, i.unit_price, i.subtotal, p.name as product_name, p.name as name
       FROM tbl_order_items i
       LEFT JOIN tbl_products p ON p.id = i.product_id
       WHERE i.order_id = $1`,
      [orderId]
    );
    updatedOrder.items = itemsRes.rows;

    res.json(updatedOrder);
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof BusinessError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('❌ Update order status error:', error);
    res.status(500).json({ error: error.message || 'Failed to update order status' });
  } finally {
    client.release();
  }
});

// ===== DELETE ORDER (SOFT VOID) =====
router.delete('/:id', authenticate, async (req, res) => {
  const tenantId = getTenantId(req, res);
  if (!tenantId && !req.user?.isSuperAdmin) return;
  const userId = req.user?.userId;
  const orderId = req.params.id;
  const { reason } = req.body || {};

  if (!/^[1-9]\d{0,9}$/.test(String(orderId))) {
    return res.status(400).json({ error: 'Invalid order ID format' });
  }

  if (!reason) {
    return res.status(400).json({ error: 'Void reason is required' });
  }

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
    await reverseOrder(client, order, 'VOID', userId, reason);

    await client.query('COMMIT');
    clearTenantCache(tenantId);
    res.status(204).end();
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof BusinessError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('❌ Delete/void order error:', error);
    res.status(500).json({ error: error.message || 'Failed to void order' });
  } finally {
    client.release();
  }
});

module.exports = router;
