// backend/tests/analyticsLocalDay.test.js
//
// Phase 10c: analytics-summary buckets revenue_by_day / revenue_by_month by
// the tenant's local day (Asia/Phnom_Penh, UTC+7; the schema has no tenant
// timezone column). Every expected value below comes from the seeded
// constants in this file, never from a replica query.
const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/app');
const db = require('../src/config/postgres');

const runId = crypto.randomBytes(4).toString('hex');
const prefix = `tal-${runId}-`;

describe('Analytics local-day bucketing and order filters', () => {
  let tokenA, tokenB;
  let tenantAId, tenantBId;
  let customerAId;

  // Fixed window: every expected bucket is a constant.
  const from = '2026-03-01T00:00:00.000Z';
  const to = '2026-03-31T00:00:00.000Z';

  const summary = (token) =>
    request(app)
      .get(`/api/dashboard/analytics-summary?from=${from}&to=${to}`)
      .set('Authorization', 'Bearer ' + token);

  const createTenant = async (label) => {
    const subdomain = `${prefix}${label}`;
    await db.query('DELETE FROM tenants WHERE subdomain = $1', [subdomain]);

    await request(app)
      .post('/api/auth/register-client')
      .send({
        businessName: `Local Day ${label}`,
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

  // Seeded constants: one item per order, qty 1.
  // Completed orders: unit_price 50, buy_price 20 -> revenue 50, profit 30.
  // Excluded orders:  unit_price 77, buy_price 30 -> revenue 77, profit 47.
  const insertOrder = async (tenantId, productId, orderNo, status, createdAt, opts = {}) => {
    const revenue = opts.revenue === undefined ? 50 : opts.revenue;
    const buyPrice = opts.buyPrice === undefined ? 20 : opts.buyPrice;
    const o = await db.query(
      `INSERT INTO tbl_orders (order_no, total, status, tenant_id, customer_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::timestamp) RETURNING or_id`,
      [`${prefix}${orderNo}`, revenue, status, tenantId, opts.customerId || null, createdAt]
    );
    await db.query(
      `INSERT INTO tbl_order_items (order_id, product_id, qty, unit_price, subtotal, tenant_id, buy_price)
       VALUES ($1, $2, 1, $3, $3, $4, $5)`,
      [o.rows[0].or_id, productId, revenue, tenantId, buyPrice]
    );
    return o.rows[0].or_id;
  };

  beforeAll(async () => {
    const a = await createTenant('a');
    tokenA = a.token;
    tenantAId = a.tenantId;

    const product = await db.query(
      `INSERT INTO tbl_products (name, price, stock, tenant_id) VALUES ($1, 50, 1000, $2) RETURNING id`,
      ['Local Day Product A', tenantAId]
    );
    const productId = product.rows[0].id;

    const customer = await db.query(
      `INSERT INTO tbl_customers (cus_id, name, tenant_id) VALUES ($1, $2, $3) RETURNING id`,
      [`CUST-${runId}`, 'Local Day Customer', tenantAId]
    );
    customerAId = customer.rows[0].id;

    // 10:00 UTC -> 17:00 local, same local day.
    await insertOrder(tenantAId, productId, 'LD-1', 'Completed', '2026-03-10 10:00:00', { customerId: customerAId });
    // 17:30 UTC -> 00:30 local on the NEXT local day (10c requirement).
    await insertOrder(tenantAId, productId, 'LD-2', 'Completed', '2026-03-10 17:30:00');
    // 17:30 UTC on the 31st -> 00:30 local on the 1st of the next month.
    await insertOrder(tenantAId, productId, 'LD-3', 'Completed', '2026-03-31 17:30:00');
    // Excluded statuses, seeded with different numbers so a leak is visible.
    await insertOrder(tenantAId, productId, 'LD-V', 'Voided', '2026-03-10 12:00:00', { revenue: 77, buyPrice: 30 });
    await insertOrder(tenantAId, productId, 'LD-C', 'Cancelled', '2026-03-10 12:00:00', { revenue: 77, buyPrice: 30 });
    await insertOrder(tenantAId, productId, 'LD-R', 'Refunded', '2026-03-10 12:00:00', { revenue: 77, buyPrice: 30 });

    const b = await createTenant('b');
    tokenB = b.token;
    tenantBId = b.tenantId;
  });

  afterAll(async () => {
    await db.query('DELETE FROM tenants WHERE id IN ($1, $2)', [tenantAId, tenantBId]);
  });

  test('revenue_by_day buckets sales by Asia/Phnom_Penh local day', async () => {
    const res = await summary(tokenA);
    expect(res.status).toBe(200);
    expect(res.body.revenue_by_day).toEqual([
      { date: '2026-03-10', revenue: 50, orders: 1, units: 1, profit: 30 },
      { date: '2026-03-11', revenue: 50, orders: 1, units: 1, profit: 30 },
      { date: '2026-04-01', revenue: 50, orders: 1, units: 1, profit: 30 },
    ]);
  });

  test('a sale at 17:30 UTC lands on the next local day', async () => {
    const res = await summary(tokenA);
    expect(res.status).toBe(200);

    const nextLocalDay = res.body.revenue_by_day.find(r => r.date === '2026-03-11');
    expect(nextLocalDay).toEqual({ date: '2026-03-11', revenue: 50, orders: 1, units: 1, profit: 30 });

    const utcDay = res.body.revenue_by_day.find(r => r.date === '2026-03-10');
    expect(utcDay.revenue).toBe(50);
    expect(utcDay.orders).toBe(1);
  });

  test('revenue_by_month buckets sales by local month', async () => {
    const res = await summary(tokenA);
    expect(res.status).toBe(200);
    expect(res.body.revenue_by_month).toEqual([
      { month: '2026-03', revenue: 100, orders: 2, units: 2, profit: 60 },
      { month: '2026-04', revenue: 50, orders: 1, units: 1, profit: 30 },
    ]);
  });

  test('Voided, Cancelled and Refunded orders are excluded from analytics', async () => {
    const res = await summary(tokenA);
    expect(res.status).toBe(200);
    expect(res.body.total_orders).toBe(3);
    expect(res.body.net_revenue).toBe(150);

    const day = res.body.revenue_by_day.find(r => r.date === '2026-03-10');
    expect(day.revenue).toBe(50);
    expect(day.orders).toBe(1);
  });

  test('analytics gross profit comes from the seeded buy_price', async () => {
    const res = await summary(tokenA);
    expect(res.status).toBe(200);
    expect(res.body.gross_profit).toBe(90);
    expect(res.body.profit_margin).toBe(60);
  });

  test('tenant B gets zero rows for tenant A customer_id filter', async () => {
    const own = await request(app)
      .get(`/api/orders?customer_id=${customerAId}`)
      .set('Authorization', 'Bearer ' + tokenA);
    expect(own.status).toBe(200);
    expect(own.body.orders).toHaveLength(1);

    const other = await request(app)
      .get(`/api/orders?customer_id=${customerAId}`)
      .set('Authorization', 'Bearer ' + tokenB);
    expect(other.status).toBe(200);
    expect(other.body.orders).toHaveLength(0);
    expect(other.body.pagination.total).toBe(0);
  });

  test('a non-numeric customer_id on GET /orders is rejected with 400', async () => {
    const res = await request(app)
      .get('/api/orders?customer_id=abc')
      .set('Authorization', 'Bearer ' + tokenA);
    expect(res.status).toBe(400);
  });
});
