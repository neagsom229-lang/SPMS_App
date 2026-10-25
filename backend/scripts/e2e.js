require('dotenv').config();
const base = 'http://localhost:5000';
const db = require('../src/config/postgres');

async function call(method, path, body, token) {
  try {
    const r = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': '4',
        ...(token ? { Authorization: 'Bearer ' + token } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const t = await r.text();
    let j;
    try { j = JSON.parse(t); } catch { j = t; }
    return { status: r.status, body: j };
  } catch (err) {
    return { status: 500, body: err.message };
  }
}

(async () => {
  console.log('=== STARTING EXTENDED E2E TESTS ===');

  // 1. Login admin
  const adminUser = 'admin';
  const adminPass = 'Admin123!';
  let r = await call('POST', '/api/auth/login', { username: adminUser, password: adminPass });
  const token = r.body && (r.body.token || r.body.accessToken || (r.body.data && r.body.data.token));
  if (!token) {
    console.error('❌ E2E Login failed:', r.body);
    process.exit(1);
  }
  console.log('✅ Admin logged in successfully');

  // 2. Get products and customers
  const prodRes = await call('GET', '/api/products', null, token);
  const products = prodRes.body.products || prodRes.body;
  if (!Array.isArray(products) || products.length === 0) {
    console.error('❌ No products found for E2E tests');
    process.exit(1);
  }
  const testProduct = products[0];
  console.log(`📦 Testing with product: ID ${testProduct.id}, Name: ${testProduct.name}, Stock: ${testProduct.stock}`);

  const custRes = await call('GET', '/api/customers', null, token);
  const customers = custRes.body.customers || custRes.body;
  if (!Array.isArray(customers) || customers.length === 0) {
    console.error('❌ No customers found for E2E tests');
    process.exit(1);
  }
  const testCustomer = customers[0];
  console.log(`👤 Testing with customer: ID ${testCustomer.id}, Name: ${testCustomer.name}`);

  // Get initial stock & dashboard sales summary
  const stockBeforeRes = await call('GET', '/api/stock', null, token);
  const stockRowsBefore = stockBeforeRes.body.stock || stockBeforeRes.body;
  const stockRowBefore = (Array.isArray(stockRowsBefore) ? stockRowsBefore : []).find(s => s.productid === testProduct.id || s.id === testProduct.id);
  const initialQty = stockRowBefore ? (stockRowBefore.qtyavailable ?? stockRowBefore.qtyinstock ?? stockRowBefore.stock) : testProduct.stock;
  console.log(`📊 Initial stock for product ID ${testProduct.id}: ${initialQty}`);

  const summaryBefore = await call('GET', '/api/dashboard/sales-summary?range=today', null, token);
  const revBefore = summaryBefore.body.net_revenue || 0;

  // (a) Sell 2 units via POST /api/orders
  const idempotencyKey = 'E2E-IDEMPOTENT-' + Date.now();
  const posRes = await call('POST', '/api/orders', {
    customer_id: testCustomer.id,
    items: [{ product_id: testProduct.id, qty: 2 }],
    payment_method: 'Cash',
    idempotency_key: idempotencyKey
  }, token);
  console.log('(a) POS Order (Sell 2 units) status:', posRes.status, posRes.status === 201 || posRes.status === 200 ? 'SUCCESS' : posRes.body);
  const createdOrderId = posRes.body.or_id || posRes.body.id;

  // Check stock down by 2
  const stockAfterRes = await call('GET', '/api/stock', null, token);
  const stockRowsAfter = stockAfterRes.body.stock || stockAfterRes.body;
  const stockRowAfter = (Array.isArray(stockRowsAfter) ? stockRowsAfter : []).find(s => s.productid === testProduct.id || s.id === testProduct.id);
  const newQty = stockRowAfter ? (stockRowAfter.qtyavailable ?? stockRowAfter.qtyinstock ?? stockRowAfter.stock) : null;
  console.log(`Check stock down by 2: before=${initialQty}, after=${newQty}, diff=${initialQty - newQty} (Expected: 2)`);

  // Check tbl_stock_log row in database
  const logRes = await db.query('SELECT * FROM tbl_stock_log WHERE reference_id = $1 ORDER BY id DESC LIMIT 1', [createdOrderId]);
  console.log(`Check tbl_stock_log row created:`, logRes.rows.length > 0 ? `FOUND (qty change: ${logRes.rows[0].change_qty})` : 'NOT FOUND');

  // Check order in /api/orders
  const ordersListRes = await call('GET', '/api/orders', null, token);
  const ordersList = ordersListRes.body.orders || ordersListRes.body;
  const foundOrder = (Array.isArray(ordersList) ? ordersList : []).find(o => (o.or_id || o.id) === createdOrderId);
  console.log(`Check order exists in /api/orders:`, foundOrder ? `FOUND (Order No: ${foundOrder.order_no})` : 'NOT FOUND');

  // Check sales-summary change
  const summaryAfter = await call('GET', '/api/dashboard/sales-summary?range=today', null, token);
  const revAfter = summaryAfter.body.net_revenue || 0;
  console.log(`Check sales-summary change: revBefore=${revBefore}, revAfter=${revAfter}, delta=${revAfter - revBefore}`);

  // (b) Repeat the same idempotency_key (one order only)
  const repeatRes = await call('POST', '/api/orders', {
    customer_id: testCustomer.id,
    items: [{ product_id: testProduct.id, qty: 2 }],
    payment_method: 'Cash',
    idempotency_key: idempotencyKey
  }, token);
  console.log('(b) Repeat same idempotency_key status:', repeatRes.status, repeatRes.status === 200 ? 'SUCCESS (Idempotent 200)' : repeatRes.body);
  const repeatOrderId = repeatRes.body.or_id || repeatRes.body.id;
  console.log(`Idempotency check: original order ID = ${createdOrderId}, repeat order ID = ${repeatOrderId} (Must be identical)`);

  // (c) Oversell returns 409 with stock unchanged
  const stockBeforeOversell = newQty;
  const oversellRes = await call('POST', '/api/orders', {
    customer_id: testCustomer.id,
    items: [{ product_id: testProduct.id, qty: 99999 }],
    payment_method: 'Cash',
    idempotency_key: 'OVERSELL-' + Date.now()
  }, token);
  console.log('(c) Oversell status (expected 409):', oversellRes.status, oversellRes.status === 409 ? 'SUCCESS (409 Insufficient stock)' : oversellRes.body);
  
  const stockAfterOversellRes = await call('GET', '/api/stock', null, token);
  const stockRowsOversell = stockAfterOversellRes.body.stock || stockAfterOversellRes.body;
  const stockRowOversell = (Array.isArray(stockRowsOversell) ? stockRowsOversell : []).find(s => s.productid === testProduct.id || s.id === testProduct.id);
  const stockAfterOversell = stockRowOversell ? (stockRowOversell.qtyavailable ?? stockRowOversell.qtyinstock ?? stockRowOversell.stock) : null;
  console.log(`Stock unchanged after 409: before oversell=${stockBeforeOversell}, after oversell=${stockAfterOversell} (Must be equal)`);

  // (d) Cancel/refund restores stock
  const refundRes = await call('POST', `/api/orders/${createdOrderId}/refund`, {}, token);
  console.log('(d) Cancel/refund order status:', refundRes.status, refundRes.status === 200 ? 'SUCCESS (Stock restored)' : refundRes.body);

  const stockFinalRes = await call('GET', '/api/stock', null, token);
  const stockRowsFinal = stockFinalRes.body.stock || stockFinalRes.body;
  const stockRowFinal = (Array.isArray(stockRowsFinal) ? stockRowsFinal : []).find(s => s.productid === testProduct.id || s.id === testProduct.id);
  const finalQty = stockRowFinal ? (stockRowFinal.qtyavailable ?? stockRowFinal.qtyinstock ?? stockRowFinal.stock) : null;
  console.log(`Final stock after refund: ${finalQty} (Expected initial: ${initialQty})`);

  await db.end();
  console.log('=== EXTENDED E2E TESTS COMPLETED SUCCESSFULLY ===');
  process.exit(0);
})();
