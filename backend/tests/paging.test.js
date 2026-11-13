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
});

describe('Analytics summary tenant-scoped SQL aggregate', () => {
  let token;
  let tenantId;

  beforeAll(async () => {
    const subdomain = `tspan-${crypto.randomBytes(4).toString('hex')}`;
    await db.query('DELETE FROM tenants WHERE subdomain = $1', [subdomain]);

    await request(app)
      .post('/api/auth/register-client')
      .send({
        businessName: 'Analytics Tenant',
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

    // Create a product for order items
    await db.query(
      `INSERT INTO tbl_products (name, price, stock, tenant_id) VALUES ($1, 10, 1000, $2)`,
      ['Analytics Product', tenantId]
    );
    const pRes = await db.query('SELECT id FROM tbl_products WHERE tenant_id = $1 LIMIT 1', [tenantId]);
    const productId = pRes.rows[0].id;

    // Seed 1,300 completed orders with order items (more than 1,000 so frontend limit=1000 would miss some)
    await db.query(
      `INSERT INTO tbl_orders (order_no, total, status, tenant_id, created_at)
       SELECT 'AN-' || g, 50.00, 'Completed', $1, NOW() - (g % 10) * INTERVAL '1 hour'
       FROM generate_series(1, 1300) g`,
      [tenantId]
    );
    const oRes = await db.query('SELECT or_id FROM tbl_orders WHERE tenant_id = $1 AND order_no LIKE $2 ORDER BY or_id', [tenantId, 'AN-%']);
    for (const row of oRes.rows) {
      await db.query(
        `INSERT INTO tbl_order_items (order_id, product_id, qty, unit_price, subtotal, tenant_id, buy_price)
         VALUES ($1, $2, 1, 50.00, 50.00, $3, 20.00)`,
        [row.or_id, productId, tenantId]
      );
    }
  });

  afterAll(async () => {
    await db.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
  });

  test('analytics-summary endpoint matches direct SQL SUM on 1,300 orders', async () => {
    const from = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const to = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .get(`/api/dashboard/analytics-summary?from=${from}&to=${to}`)
      .set('Authorization', 'Bearer ' + token);

    expect(res.status).toBe(200);
    expect(res.body.total_orders).toBeGreaterThan(1200);

    // Direct SQL SUM for comparison
    const sqlRes = await db.query(
      `SELECT 
         COALESCE(SUM(i.subtotal - COALESCE(i.refunded_amount, 0)), 0) as net_revenue,
         COUNT(DISTINCT o.or_id) as total_orders,
         COALESCE(AVG(o.total), 0) as average_order_value,
         COALESCE(SUM((i.unit_price - COALESCE(i.buy_price, 0)) * (i.qty - COALESCE(i.refunded_qty, 0))), 0) as gross_profit
       FROM tbl_orders o
       JOIN tbl_order_items i ON i.order_id = o.or_id
       WHERE o.tenant_id = $1
         AND o.status = 'Completed'
         AND o.created_at >= $2::timestamptz
         AND o.created_at <= $3::timestamptz`,
      [tenantId, from, new Date(new Date(to).getTime() + 86400000 - 1).toISOString()]
    );

    const sqlRow = sqlRes.rows[0];
    expect(parseFloat(res.body.net_revenue)).toBe(parseFloat(sqlRow.net_revenue));
    expect(res.body.total_orders).toBe(parseInt(sqlRow.total_orders, 10));
    expect(parseFloat(res.body.average_order_value)).toBe(parseFloat(sqlRow.average_order_value));
    expect(parseFloat(res.body.gross_profit)).toBe(parseFloat(sqlRow.gross_profit));
  });
});
