const express = require('express');
const router = express.Router();
const db = require('../config/postgres');
const crypto = require('crypto');

// Helper to resolve store by slug
async function getStoreBySlug(client, slug) {
  const queryText = 'SELECT * FROM store_settings WHERE slug = $1';
  console.log('🔍 Lookup store query:', queryText, [slug]);
  const res = await client.query(queryText, [slug]);
  if (res.rowCount === 0) return null;
  const store = res.rows[0];

  // Get tenant info
  const tenantRes = await client.query('SELECT * FROM tenants WHERE id = $1', [store.tenant_id]);
  const tenant = tenantRes.rows[0] || {};

  return { ...store, tenant_id: tenant.id, tenant_status: tenant.status };
}

// GET /api/public/store/:slug
router.get('/store/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const store = await getStoreBySlug(db, slug);
    if (!store || !store.tenant_status || store.tenant_status.toLowerCase() !== 'active') {
      return res.status(404).json({ error: 'Store not found or inactive' });
    }

    // Exclude private metadata
    const { tenant_status, ...publicStore } = store;
    res.json({ success: true, store: publicStore });
  } catch (err) {
    console.error('❌ Get public store error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/public/store/:slug/categories
router.get('/store/:slug/categories', async (req, res) => {
  try {
    const { slug } = req.params;
    const store = await getStoreBySlug(db, slug);
    if (!store) return res.status(404).json({ error: 'Store not found' });

    const query = `
      SELECT c.id, c.name, '' as description, COUNT(p.id) as product_count
      FROM tbl_categories c
      LEFT JOIN tbl_products p ON p.category_id = c.id AND p.tenant_id = $1 AND p.is_published = true AND LOWER(p.status) = 'active'
      WHERE c.tenant_id = $1
      GROUP BY c.id, c.name
      ORDER BY c.name ASC
    `;
    const result = await db.query(query, [store.tenant_id]);
    res.json({ success: true, categories: result.rows });
  } catch (err) {
    console.error('❌ Get public categories error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/public/store/:slug/menu
router.get('/store/:slug/menu', async (req, res) => {
  try {
    const { slug } = req.params;
    const { category, q, sort, page = 1, limit = 20 } = req.query;

    const store = await getStoreBySlug(db, slug);
    if (!store) return res.status(404).json({ error: 'Store not found' });

    let query = `
      SELECT p.id, p.name, p.name_kh, p.price, p.image_url, p.description_en, p.description_kh,
             p.barcode, c.name as category_name,
             COALESCE(s.qtyavailable, 0) as qtyavailable,
             COALESCE(s.minstocklevel, 5) as minstocklevel
      FROM tbl_products p
      LEFT JOIN tbl_categories c ON p.category_id = c.id
      LEFT JOIN tbl_stock s ON s.productid = p.id AND s.tenant_id = p.tenant_id
      WHERE p.tenant_id = $1 AND p.is_published = true AND LOWER(p.status) = 'active'
    `;
    const params = [store.tenant_id];
    let paramIdx = 2;

    if (category) {
      query += ` AND p.category_id = $${paramIdx++}`;
      params.push(category);
    }

    if (q) {
      query += ` AND (p.name ILIKE $${paramIdx} OR p.name_kh ILIKE $${paramIdx} OR p.barcode ILIKE $${paramIdx})`;
      params.push(`%${q}%`);
      paramIdx++;
    }

    // Sorting
    if (sort === 'price_asc') {
      query += ` ORDER BY p.price ASC`;
    } else if (sort === 'price_desc') {
      query += ` ORDER BY p.price DESC`;
    } else if (sort === 'name') {
      query += ` ORDER BY p.name ASC`;
    } else {
      query += ` ORDER BY p.sort_order ASC, p.id DESC`;
    }

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    query += ` LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(parseInt(limit, 10), offset);

    const result = await db.query(query, params);

    // Map stock status without exposing exact counts (only stock_status: in_stock / low / out)
    const products = result.rows.map(item => {
      const qty = parseInt(item.qtyavailable, 10);
      const minStock = parseInt(item.minstocklevel, 5);
      let stock_status = 'in_stock';
      if (qty <= 0) stock_status = 'out';
      else if (qty <= minStock) stock_status = 'low';

      return {
        id: item.id,
        name_en: item.name,
        name_kh: item.name_kh,
        price: parseFloat(item.price),
        image_url: item.image_url,
        description_en: item.description_en,
        description_kh: item.description_kh,
        category_name: item.category_name,
        barcode: item.barcode,
        stock_status
      };
    });

    res.json({ success: true, products });
  } catch (err) {
    console.error('❌ Get public menu error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/public/store/:slug/orders -> Create Online Order
router.post('/store/:slug/orders', async (req, res) => {
  const client = await db.connect();
  try {
    const { slug } = req.params;
    const {
      customer_name,
      customer_phone,
      delivery_type, // 'pickup' | 'delivery'
      delivery_address,
      notes,
      items, // [{ product_id, qty }]
      idempotency_key,
      payment_method
    } = req.body;

    if (!customer_name || !customer_phone || !items || !Array.isArray(items) || items.length === 0) {
      client.release();
      return res.status(400).json({ error: 'Missing required order fields or items' });
    }

    if (!idempotency_key) {
      client.release();
      return res.status(400).json({ error: 'Idempotency key is required' });
    }

    await client.query('BEGIN');

    // 1. Get store & tenant
    const storeRes = await client.query('SELECT * FROM store_settings WHERE slug = $1', [slug]);
    if (storeRes.rowCount === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Store not found' });
    }
    const store = storeRes.rows[0];
    if (!store.is_open || !store.accepts_online_orders) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: 'Store is currently closed for online orders' });
    }

    // 2. Check Idempotency Key
    const existingOrder = await client.query(
      'SELECT or_id, order_no, tracking_code FROM tbl_orders WHERE idempotency_key = $1',
      [idempotency_key]
    );
    if (existingOrder.rowCount > 0) {
      await client.query('COMMIT');
      client.release();
      const ord = existingOrder.rows[0];
      return res.status(200).json({
        success: true,
        message: 'Order already processed (idempotent)',
        order_no: ord.order_no,
        tracking_code: ord.tracking_code,
        order_id: ord.or_id
      });
    }

    // 3. Re-read prices & validate stock with SELECT ... FOR UPDATE
    let totalAmount = 0;
    const orderItemsParsed = [];

    for (const item of items) {
      const prodId = item.product_id;
      const orderQty = parseInt(item.qty, 10);
      if (isNaN(orderQty) || orderQty <= 0) {
        throw new Error(`Invalid quantity for product ID ${prodId}`);
      }

      // Lock product & stock row
      const prodRes = await client.query(
        'SELECT id, price, cost, name FROM tbl_products WHERE id = $1 AND tenant_id = $2 AND is_published = true',
        [prodId, store.tenant_id]
      );
      if (prodRes.rowCount === 0) {
        throw new Error(`Product ID ${prodId} not found or unavailable`);
      }
      const prod = prodRes.rows[0];

      const stockRes = await client.query(
        'SELECT qtyavailable FROM tbl_stock WHERE productid = $1 AND tenant_id = $2 FOR UPDATE',
        [prodId, store.tenant_id]
      );
      if (stockRes.rowCount === 0) {
        throw new Error(`Stock record not found for product: ${prod.name}`);
      }
      const currentStock = parseInt(stockRes.rows[0].qtyavailable, 10);

      if (currentStock < orderQty) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(409).json({
          error: 'Insufficient stock',
          product_id: prodId,
          product_name: prod.name,
          requested: orderQty,
          available: currentStock
        });
      }

      const price = parseFloat(prod.price);
      const buyPrice = parseFloat(prod.cost || 0);
      const subtotal = price * orderQty;
      totalAmount += subtotal;

      orderItemsParsed.push({
        product_id: prodId,
        qty: orderQty,
        price,
        buy_price: buyPrice,
        subtotal
      });
    }

    // Add tax if applicable
    const taxRate = parseFloat(store.tax_rate || 0);
    const taxAmount = (totalAmount * taxRate) / 100;
    const finalTotal = totalAmount + taxAmount;

    // Generate Order Number & Tracking Code
    const orderNo = `ONLINE-${Date.now().toString().slice(-6)}`;
    const trackingCode = crypto.randomBytes(12).toString('hex');

    // 4. Insert Order
    const insertOrderRes = await client.query(
      `INSERT INTO tbl_orders 
       (tenant_id, order_no, total, discount, status, payment_method, source, customer_name, customer_phone, delivery_type, delivery_address, notes, tracking_code, idempotency_key, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW()) RETURNING or_id`,
      [
        store.tenant_id,
        orderNo,
        finalTotal,
        0, // discount
        'Pending',
        payment_method || 'Cash',
        'ONLINE',
        customer_name,
        customer_phone,
        delivery_type || 'pickup',
        delivery_address || '',
        notes || '',
        trackingCode,
        idempotency_key
      ]
    );
    const orderId = insertOrderRes.rows[0].or_id;

    // 5. Insert Order Items and Decrement Stock & Write Stock Log
    for (const item of orderItemsParsed) {
      await client.query(
        `INSERT INTO tbl_order_items (order_id, product_id, qty, unit_price, buy_price, subtotal, tenant_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [orderId, item.product_id, item.qty, item.price, item.buy_price, item.subtotal, store.tenant_id]
      );

      // Decrement stock
      await client.query(
        `UPDATE tbl_stock SET qtyavailable = qtyavailable - $1 WHERE productid = $2 AND tenant_id = $3`,
        [item.qty, item.product_id, store.tenant_id]
      );

      // Write stock log
      await client.query(
        `INSERT INTO tbl_stock_log (tenant_id, product_id, change_qty, type, reference_id, notes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [store.tenant_id, item.product_id, -item.qty, 'ONLINE_ORDER', orderId, `Online order #${orderNo}`]
      );
    }

    await client.query('COMMIT');
    client.release();

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      order_no: orderNo,
      tracking_code: trackingCode,
      order_id: orderId,
      total: finalTotal
    });
  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    console.error('❌ Create online order error:', err.message);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// GET /api/public/orders/:trackingCode -> Customer Order Status
router.get('/orders/:trackingCode', async (req, res) => {
  try {
    const { trackingCode } = req.params;
    const orderRes = await db.query(
      `SELECT o.or_id, o.order_no, o.status, o.payment_method, o.total, o.source,
              o.customer_name, o.delivery_type, o.delivery_address, o.created_at,
              s.store_name, s.phone as store_phone
       FROM tbl_orders o
       JOIN store_settings s ON s.tenant_id = o.tenant_id
       WHERE o.tracking_code = $1`,
      [trackingCode]
    );

    if (orderRes.rowCount === 0) {
      return res.status(404).json({ error: 'Order not found with tracking code' });
    }

    const order = orderRes.rows[0];

    const detailsRes = await db.query(
      `SELECT d.qty, d.unit_price as price, d.subtotal, p.name as name_en, p.name_kh
       FROM tbl_order_items d
       JOIN tbl_products p ON p.id = d.product_id
       WHERE d.order_id = $1`,
      [order.or_id]
    );

    res.json({
      success: true,
      order: {
        order_no: order.order_no,
        status: order.status,
        payment_status: order.status,
        total: parseFloat(order.total),
        source: order.source,
        customer_name: order.customer_name,
        delivery_type: order.delivery_type,
        delivery_address: order.delivery_address,
        order_date: order.created_at,
        store_name: order.store_name,
        store_phone: order.store_phone,
        items: detailsRes.rows
      }
    });
  } catch (err) {
    console.error('❌ Get order status error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
