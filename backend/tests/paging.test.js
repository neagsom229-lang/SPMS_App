// backend/tests/paging.test.js
const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/app');
const db = require('../src/config/postgres');

const runId = crypto.randomBytes(4).toString('hex');
const prefix = `tspg-${runId}`;
const subdomain = prefix;

describe('Paging clamp and fallback', () => {
  let token;
  let tenantId;

  beforeAll(async () => {
    await db.query('DELETE FROM tenants WHERE subdomain = $1', [subdomain]);

    await request(app)
      .post('/api/auth/register-client')
      .send({
        businessName: 'Paging Tenant',
        email: subdomain + '@test.com',
        password: 'Qa!123456',
        subdomain,
      });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: subdomain + '_admin', password: 'Qa!123456' });
    token = login.body.token;

    const tRes = await db.query('SELECT id FROM tenants WHERE subdomain = $1', [subdomain]);
    tenantId = tRes.rows[0].id;

    await db.query(
      `INSERT INTO tbl_orders (order_no, total, status, tenant_id, created_at)
       SELECT 'PAGE-' || g, 10, 'Completed', $1, NOW()
       FROM generate_series(1, 205) g`,
      [tenantId]
    );

    await db.query(
      `INSERT INTO tbl_orders (order_no, total, status, tenant_id, created_at)
       SELECT 'PEN-' || g, 10, 'Pending', $1, NOW()
       FROM generate_series(1, 205) g`,
      [tenantId]
    );

    await db.query(
      `INSERT INTO tbl_stock_log (tenant_id, product_id, change_qty, type, reference_id, notes, created_at)
       SELECT $1, NULL, 5, 'ADJUST', NULL, 'paging seed', NOW() - (g % 5) * INTERVAL '1 minute'
       FROM generate_series(1, 205) g`,
      [tenantId]
    );
  });

  afterAll(async () => {
    await db.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
  });

  test('limit=100000 on the orders list is clamped to 200 rows', async () => {
    const res = await request(app)
      .get('/api/orders?limit=100000')
      .set('Authorization', 'Bearer ' + token);

    expect(res.status).toBe(200);
    expect(res.body.pagination.limit).toBe(200);
    expect(res.body.orders.length).toBe(200);
  });

  test('page=-5 on the orders list falls back to page 1 instead of a 500', async () => {
    const res = await request(app)
      .get('/api/orders?page=-5')
      .set('Authorization', 'Bearer ' + token);

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(1);
  });

  test('page=abc on the orders list falls back to page 1 instead of a 500', async () => {
    const res = await request(app)
      .get('/api/orders?page=abc')
      .set('Authorization', 'Bearer ' + token);

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(1);
  });

  test('limit=abc on /orders/recent falls back to the default page size instead of a 500', async () => {
    const res = await request(app)
      .get('/api/orders/recent?limit=abc')
      .set('Authorization', 'Bearer ' + token);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(5);
  });

  test('limit=-1 on /orders/recent falls back to the default page size instead of a 500', async () => {
    const res = await request(app)
      .get('/api/orders/recent?limit=-1')
      .set('Authorization', 'Bearer ' + token);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(5);
  });

  test('limit=100000 on /orders/recent is clamped to 200 rows', async () => {
    const res = await request(app)
      .get('/api/orders/recent?limit=100000')
      .set('Authorization', 'Bearer ' + token);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(200);
  });

  test('limit=abc on /orders/pending falls back to the default page size instead of a 500', async () => {
    const res = await request(app)
      .get('/api/orders/pending?limit=abc')
      .set('Authorization', 'Bearer ' + token);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(10);
  });

  test('limit=-1 on /orders/pending falls back to the default page size instead of a 500', async () => {
    const res = await request(app)
      .get('/api/orders/pending?limit=-1')
      .set('Authorization', 'Bearer ' + token);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(10);
  });

  test('limit=100000 on /orders/pending is clamped to 200 rows', async () => {
    const res = await request(app)
      .get('/api/orders/pending?limit=100000')
      .set('Authorization', 'Bearer ' + token);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(200);
  });

  test('limit=abc on /stock/log falls back to the default page size instead of a 500', async () => {
    const res = await request(app)
      .get('/api/stock/log?limit=abc')
      .set('Authorization', 'Bearer ' + token);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(50);
  });

  test('limit=-1 on /stock/log falls back to the default page size instead of a 500', async () => {
    const res = await request(app)
      .get('/api/stock/log?limit=-1')
      .set('Authorization', 'Bearer ' + token);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(50);
  });

  test('limit=100000 on /stock/log is clamped to 200 rows', async () => {
    const res = await request(app)
      .get('/api/stock/log?limit=100000')
      .set('Authorization', 'Bearer ' + token);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(200);
  });
});

describe('Analytics summary tenant-scoped SQL aggregate', () => {
  let tokenA, tokenB, tokenC;
  let tenantAId, tenantBId, tenantCId;
  let productAId;
  const from = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const to = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const effectiveTo = new Date(new Date(to).getTime() + 86400000 - 1).toISOString();

  const createTenant = async (label) => {
    const subdomain = `tspan-${label}-${crypto.randomBytes(4).toString('hex')}`;
    await db.query('DELETE FROM tenants WHERE subdomain = $1', [subdomain]);

    await request(app)
      .post('/api/auth/register-client')
      .send({
        businessName: `Analytics ${label}`,
        email: subdomain + '@test.com',
        password: 'Qa!123456',
        subdomain,
      });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: subdomain + '_admin', password: 'Qa!123456' });

    const tRes = await db.query('SELECT id FROM tenants WHERE subdomain = $1', [subdomain]);
    return { token: login.body.token, tenantId: tRes.rows[0].id };
  };

  beforeAll(async () => {
    const a = await createTenant('a');
    tokenA = a.token;
    tenantAId = a.tenantId;

    const created = await db.query(
      `INSERT INTO tbl_products (name, price, stock, tenant_id) VALUES ($1, 10, 1000, $2) RETURNING id`,
      ['Analytics Product A', tenantAId]
    );
    productAId = created.rows[0].id;

    // More than 1,200 orders, so a 1,000-row download cannot represent them.
    await db.query(
      `INSERT INTO tbl_orders (order_no, total, status, tenant_id, created_at)
       SELECT 'AN-' || g, 50.00, 'Completed', $1, NOW() - (g % 10) * INTERVAL '1 hour'
       FROM generate_series(1, 1300) g`,
      [tenantAId]
    );
    await db.query(
      `INSERT INTO tbl_order_items (order_id, product_id, qty, unit_price, subtotal, tenant_id, buy_price)
       SELECT o.or_id, $2, 1, 50.00, 50.00, $1, 20.00
       FROM tbl_orders o WHERE o.tenant_id = $1 AND o.order_no LIKE 'AN-%'`,
      [tenantAId, productAId]
    );

    const b = await createTenant('b');
    tokenB = b.token;
    tenantBId = b.tenantId;

    const createdB = await db.query(
      `INSERT INTO tbl_products (name, price, stock, tenant_id) VALUES ($1, 999, 100, $2) RETURNING id`,
      ['Analytics Product B', tenantBId]
    );
    await db.query(
      `INSERT INTO tbl_orders (order_no, total, status, tenant_id, created_at)
       SELECT 'BN-' || g, 999.00, 'Completed', $1, NOW()
       FROM generate_series(1, 2) g`,
      [tenantBId]
    );
    await db.query(
      `INSERT INTO tbl_order_items (order_id, product_id, qty, unit_price, subtotal, tenant_id, buy_price)
       SELECT o.or_id, $2, 5, 199.80, 999.00, $1, 100.00
       FROM tbl_orders o WHERE o.tenant_id = $1 AND o.order_no LIKE 'BN-%'`,
      [tenantBId, createdB.rows[0].id]
    );

    const c = await createTenant('c');
    tokenC = c.token;
    tenantCId = c.tenantId;
  });

  afterAll(async () => {
    await db.query('DELETE FROM tenants WHERE id IN ($1, $2, $3)', [tenantAId, tenantBId, tenantCId]);
  });

  const summary = (token, tenantId) => request(app)
    .get(`/api/dashboard/analytics-summary?from=${from}&to=${to}`)
    .set('Authorization', 'Bearer ' + token);

  test('analytics-summary totals match direct SQL on more than 1,200 orders', async () => {
    const res = await summary(tokenA);
    expect(res.status).toBe(200);
    expect(res.body.total_orders).toBeGreaterThan(1200);

    const sqlRes = await db.query(
      `SELECT 
         COALESCE(SUM(i.subtotal - COALESCE(i.refunded_amount, 0)), 0) as net_revenue,
         COUNT(DISTINCT o.or_id) as total_orders,
         COALESCE(AVG(o.total), 0) as average_order_value,
         COALESCE(SUM((i.unit_price - COALESCE(i.buy_price, 0)) * (i.qty - COALESCE(i.refunded_qty, 0))), 0) as gross_profit,
         COUNT(DISTINCT i.product_id) as products_sold
       FROM tbl_orders o
       JOIN tbl_order_items i ON i.order_id = o.or_id
       WHERE o.tenant_id = $1
         AND o.status = 'Completed'
         AND o.created_at >= $2::timestamptz
         AND o.created_at <= $3::timestamptz`,
      [tenantAId, from, effectiveTo]
    );

    const sqlRow = sqlRes.rows[0];
    expect(parseFloat(res.body.net_revenue)).toBe(parseFloat(sqlRow.net_revenue));
    expect(res.body.total_orders).toBe(parseInt(sqlRow.total_orders, 10));
    expect(parseFloat(res.body.average_order_value)).toBe(parseFloat(sqlRow.average_order_value));
    expect(parseFloat(res.body.gross_profit)).toBe(parseFloat(sqlRow.gross_profit));
    expect(res.body.products_sold).toBe(parseInt(sqlRow.products_sold, 10));
  });

  test('analytics-summary revenue_by_day matches direct SQL per-day sums', async () => {
    const res = await summary(tokenA);
    expect(res.status).toBe(200);

    const sqlRes = await db.query(
      `SELECT to_char(date_trunc('day', (o.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Phnom_Penh'), 'YYYY-MM-DD') AS date,
              COALESCE(SUM(i.subtotal - COALESCE(i.refunded_amount, 0)), 0) AS revenue,
              COUNT(DISTINCT o.or_id) AS orders
       FROM tbl_orders o
       JOIN tbl_order_items i ON i.order_id = o.or_id
       WHERE o.tenant_id = $1
         AND o.status = 'Completed'
         AND o.created_at >= $2::timestamptz
         AND o.created_at <= $3::timestamptz
       GROUP BY 1 ORDER BY 1`,
      [tenantAId, from, effectiveTo]
    );

    const expected = sqlRes.rows.map(r => ({
      date: r.date,
      revenue: parseFloat(r.revenue),
      orders: parseInt(r.orders, 10),
    }));
    expect(res.body.revenue_by_day.map(r => ({
      date: r.date,
      revenue: r.revenue,
      orders: r.orders,
    }))).toEqual(expected);
  });

  test('analytics-summary revenue_by_month matches direct SQL per-month sums', async () => {
    const res = await summary(tokenA);
    expect(res.status).toBe(200);

    const sqlRes = await db.query(
      `SELECT to_char(date_trunc('month', (o.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Phnom_Penh'), 'YYYY-MM') AS month,
              COALESCE(SUM(i.subtotal - COALESCE(i.refunded_amount, 0)), 0) AS revenue,
              COUNT(DISTINCT o.or_id) AS orders
       FROM tbl_orders o
       JOIN tbl_order_items i ON i.order_id = o.or_id
       WHERE o.tenant_id = $1
         AND o.status = 'Completed'
         AND o.created_at >= $2::timestamptz
         AND o.created_at <= $3::timestamptz
       GROUP BY 1 ORDER BY 1`,
      [tenantAId, from, effectiveTo]
    );

    const expected = sqlRes.rows.map(r => ({
      month: r.month,
      revenue: parseFloat(r.revenue),
      orders: parseInt(r.orders, 10),
    }));
    expect(res.body.revenue_by_month.map(r => ({
      month: r.month,
      revenue: r.revenue,
      orders: r.orders,
    }))).toEqual(expected);
  });

  test('analytics-summary top products by quantity and revenue match direct SQL', async () => {
    const res = await summary(tokenA);
    expect(res.status).toBe(200);

    const sqlRes = await db.query(
      `SELECT i.product_id,
              COALESCE(p.name, 'Unknown Product') AS name,
              COALESCE(SUM(i.qty - COALESCE(i.refunded_qty, 0)), 0) AS qty,
              COALESCE(SUM(i.subtotal - COALESCE(i.refunded_amount, 0)), 0) AS revenue,
              COALESCE(SUM((i.unit_price - COALESCE(i.buy_price, 0)) * (i.qty - COALESCE(i.refunded_qty, 0))), 0) AS profit
       FROM tbl_order_items i
       JOIN tbl_orders o ON o.or_id = i.order_id
       LEFT JOIN tbl_products p ON p.id = i.product_id AND p.tenant_id = o.tenant_id
       WHERE o.tenant_id = $1
         AND o.status = 'Completed'
         AND o.created_at >= $2::timestamptz
         AND o.created_at <= $3::timestamptz
       GROUP BY i.product_id, p.name
       ORDER BY revenue DESC, qty DESC LIMIT 10`,
      [tenantAId, from, effectiveTo]
    );

    const expected = sqlRes.rows.map(r => ({
      product_id: r.product_id,
      name: r.name,
      qty: parseInt(r.qty, 10),
      revenue: parseFloat(r.revenue),
      profit: parseFloat(r.profit),
    }));
    expect(res.body.top_products_by_revenue).toEqual(expected);
    expect(res.body.top_products_by_qty).toEqual(expected);
  });

  test('analytics-summary does not leak a second tenant\'s orders', async () => {
    const resB = await summary(tokenB);
    expect(resB.status).toBe(200);

    expect(resB.body.total_orders).toBe(2);
    expect(resB.body.net_revenue).toBe(1998);
    expect(resB.body.top_products_by_revenue).toHaveLength(1);
    expect(resB.body.top_products_by_revenue[0].name).toBe('Analytics Product B');
    expect(resB.body.top_products_by_qty.map(p => p.name)).toEqual(['Analytics Product B']);

    const resA = await summary(tokenA);
    expect(resA.body.total_orders).toBe(1300);
    expect(resA.body.net_revenue).toBe(65000);
    expect(resA.body.top_products_by_revenue.map(p => p.name)).not.toContain('Analytics Product B');
  });

  test('analytics-summary returns zeros and empty arrays for an empty tenant', async () => {
    const res = await summary(tokenC);
    expect(res.status).toBe(200);

    expect(res.body.net_revenue).toBe(0);
    expect(res.body.total_orders).toBe(0);
    expect(res.body.average_order_value).toBe(0);
    expect(res.body.units_sold).toBe(0);
    expect(res.body.gross_profit).toBe(0);
    expect(res.body.profit_margin).toBe(0);
    expect(res.body.total_customers).toBe(0);
    expect(res.body.products_sold).toBe(0);
    expect(res.body.revenue_by_day).toEqual([]);
    expect(res.body.revenue_by_month).toEqual([]);
    expect(res.body.revenue_by_year).toEqual([]);
    expect(res.body.top_products_by_qty).toEqual([]);
    expect(res.body.top_products_by_revenue).toEqual([]);
    expect(res.body.customers).toEqual([]);
  });
});
