require('dotenv').config();
delete process.env.DATABASE_URL;
delete process.env.DIRECT_URL;

const base = 'http://localhost:5000';
const db = require('../src/config/postgres');

async function call(method, path, body, token) {
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
}

(async () => {
  console.log('=== SUMMARY CHECK & RECONCILIATION SCRIPT ===');

  // Login admin
  const adminPass = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';
  const loginRes = await call('POST', '/api/auth/login', { username: 'admin', password: adminPass });
  const token = loginRes.body && (loginRes.body.token || loginRes.body.accessToken || (loginRes.body.data && loginRes.body.data.token));
  if (!token) {
    console.error('❌ Login failed:', loginRes.body);
    process.exit(1);
  }
  console.log('✅ Admin logged in successfully');

  // 1. Test sales-summary for today, 7d, 30d, month, and custom range
  const ranges = ['today', '7d', '30d', 'month', 'custom?from=2026-01-01&to=2026-12-31'];
  for (const rng of ranges) {
    const res = await call('GET', `/api/dashboard/sales-summary?range=${rng}`, null, token);
    console.log(`--- Range: ${rng} (Status: ${res.status}) ---`);
    if (res.status === 200) {
      console.log(JSON.stringify({
        net_revenue: res.body.net_revenue,
        total_orders: res.body.total_orders,
        avg_order_value: res.body.avg_order_value,
        units_sold: res.body.units_sold,
        gross_profit: res.body.gross_profit,
        profit_margin: res.body.profit_margin,
        previous: res.body.previous,
        change_pct: res.body.change_pct,
        timeseries_len: res.body.timeseries?.length,
        by_category_len: res.body.by_category?.length,
        by_payment_method_len: res.body.by_payment_method?.length,
        by_source_len: res.body.by_source?.length,
        refunds: res.body.refunds,
        open_online_orders: res.body.open_online_orders,
        alerts_count: res.body.alerts?.length
      }, null, 2));
    } else {
      console.log('Error:', res.body);
    }
  }

  // 2. Reconciliation for range 30d
  console.log('\n=== RECONCILIATION FOR RANGE 30d ===');
  const summary30dRes = await call('GET', '/api/dashboard/sales-summary?range=30d', null, token);
  const apiMetrics = summary30dRes.body;

  const dbQuery = `
    SELECT 
      COALESCE(SUM(i.subtotal - COALESCE(i.refunded_amount, 0)), 0) as net_revenue,
      COUNT(DISTINCT o.or_id) as total_orders,
      COALESCE(SUM(i.qty - COALESCE(i.refunded_qty, 0)), 0) as units_sold,
      COALESCE(SUM((i.unit_price - COALESCE(i.buy_price, 0)) * (i.qty - COALESCE(i.refunded_qty, 0))), 0) as gross_profit
    FROM tbl_orders o
    JOIN tbl_order_items i ON i.order_id = o.or_id
    WHERE (o.tenant_id = 4)
      AND o.status = ANY(ARRAY['Completed', 'Paid', 'Delivered']::text[])
      AND o.created_at >= NOW() - INTERVAL '30 days'
  `;
  const dbRes = await db.query(dbQuery);
  const dbMetrics = dbRes.rows[0];

  console.table([
    { Metric: 'net_revenue', API: apiMetrics.net_revenue, Database: parseFloat(dbMetrics.net_revenue), Equal: apiMetrics.net_revenue === parseFloat(dbMetrics.net_revenue) },
    { Metric: 'total_orders', API: apiMetrics.total_orders, Database: parseInt(dbMetrics.total_orders, 10), Equal: apiMetrics.total_orders === parseInt(dbMetrics.total_orders, 10) },
    { Metric: 'units_sold', API: apiMetrics.units_sold, Database: parseInt(dbMetrics.units_sold, 10), Equal: apiMetrics.units_sold === parseInt(dbMetrics.units_sold, 10) },
    { Metric: 'gross_profit', API: apiMetrics.gross_profit, Database: parseFloat(dbMetrics.gross_profit), Equal: apiMetrics.gross_profit === parseFloat(dbMetrics.gross_profit) }
  ]);

  // 3. Test Order Creation, Cancellation (revenue unchanged, stock restored), and Buy Price = Product Cost
  console.log('\n=== TESTING ORDER CREATION, CANCELLATION & BUY PRICE ===');
  const prodRes = await call('GET', '/api/products', null, token);
  const products = prodRes.body.products || prodRes.body;
  const testProduct = products[0];
  console.log(`Test Product: ID ${testProduct.id}, Name: ${testProduct.name}, Cost: ${testProduct.cost}, Price: ${testProduct.price}`);

  const custRes = await call('GET', '/api/customers', null, token);
  const customers = custRes.body.customers || custRes.body;
  const testCustomer = customers[0];

  // Stock before order
  const stockBeforeRes = await call('GET', '/api/stock', null, token);
  const stockRowsBefore = stockBeforeRes.body.stock || stockBeforeRes.body;
  const stockRowBefore = (Array.isArray(stockRowsBefore) ? stockRowsBefore : []).find(s => s.productid === testProduct.id || s.id === testProduct.id);
  const qtyBefore = stockRowBefore ? (stockRowBefore.qtyavailable ?? stockRowBefore.stock) : 0;
  console.log(`Stock before order: ${qtyBefore}`);

  const revBefore = apiMetrics.net_revenue;

  // Create Completed Order
  const orderRes = await call('POST', '/api/orders', {
    customer_id: testCustomer.id,
    items: [{ product_id: testProduct.id, qty: 1 }],
    payment_method: 'Cash',
    idempotency_key: 'CANCEL-TEST-' + Date.now()
  }, token);
  console.log('Create Order Status:', orderRes.status);
  const orderId = orderRes.body.or_id || orderRes.body.id;
  const orderItem = orderRes.body.items?.[0];
  console.log(`(d) Order item buy_price: ${orderItem?.buy_price} | Product cost: ${testProduct.cost} (Match: ${Number(orderItem?.buy_price) === Number(testProduct.cost)})`);

  // Stock after order
  const stockAfterRes = await call('GET', '/api/stock', null, token);
  const stockRowsAfter = stockAfterRes.body.stock || stockAfterRes.body;
  const stockRowAfter = (Array.isArray(stockRowsAfter) ? stockRowsAfter : []).find(s => s.productid === testProduct.id || s.id === testProduct.id);
  const qtyAfterOrder = stockRowAfter ? (stockRowAfter.qtyavailable ?? stockRowAfter.stock) : 0;
  console.log(`Stock after order (decremented by 1): ${qtyAfterOrder} (Expected: ${qtyBefore - 1})`);

  // Cancel order
  const cancelRes = await call('POST', `/api/orders/${orderId}/cancel`, {}, token);
  console.log('Cancel Order Status:', cancelRes.status, cancelRes.body);

  // Stock after cancel
  const stockCancelRes = await call('GET', '/api/stock', null, token);
  const stockRowsCancel = stockCancelRes.body.stock || stockCancelRes.body;
  const stockRowCancel = (Array.isArray(stockRowsCancel) ? stockRowsCancel : []).find(s => s.productid === testProduct.id || s.id === testProduct.id);
  const qtyAfterCancel = stockRowCancel ? (stockRowCancel.qtyavailable ?? stockRowCancel.stock) : 0;
  console.log(`Stock after cancel (restored): ${qtyAfterCancel} (Expected initial: ${qtyBefore})`);

  // Net revenue after cancel
  const summaryAfterCancel = await call('GET', '/api/dashboard/sales-summary?range=30d', null, token);
  const revAfterCancel = summaryAfterCancel.body.net_revenue;
  console.log(`(c) Net revenue before order: ${revBefore}, after cancel: ${revAfterCancel} (Unchanged: ${revBefore === revAfterCancel})`);

  await db.end();
  console.log('=== SUMMARY CHECK & RECONCILIATION COMPLETED ===');
  process.exit(0);
})();
