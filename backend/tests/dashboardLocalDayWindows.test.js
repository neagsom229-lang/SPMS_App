// backend/tests/dashboardLocalDayWindows.test.js
//
// 11b: sales-summary range windows must follow the Asia/Phnom_Penh local-day
// boundary. tbl_orders.created_at holds UTC wall time, so every seeded
// timestamp below is computed in JS (UTC + 7h -> local wall midnight -> back to
// UTC wall), never from the SQL expressions the route uses. Each order lives on
// its own tenant so every assertion is a single-order total.
const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/app');
const db = require('../src/config/postgres');

const runId = crypto.randomBytes(4).toString('hex');
const prefix = `dlw-${runId}-`;

const PNH_OFFSET_MS = 7 * 60 * 60 * 1000;

// UTC wall timestamp string (no offset) for a given UTC epoch ms.
const utcWall = (ms) => new Date(ms).toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');

describe('Dashboard sales-summary local-day windows', () => {
  let tokenA, tokenB, tokenC, tokenD;
  let tenantAId, tenantBId, tenantCId, tenantDId;

  // Local wall clock read from the JS clock (independent of the route's SQL).
  const nowMs = Date.now();
  const localNow = new Date(nowMs + PNH_OFFSET_MS);
  const localDayStartMs = Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate());
  const localMonthStartMs = Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), 1);

  // PNH local midnight = UTC wall (local midnight - 7h); likewise month start.
  const dayStartUtcMs = localDayStartMs - PNH_OFFSET_MS;
  const monthStartUtcMs = localMonthStartMs - PNH_OFFSET_MS;

  const localDate = new Date(localDayStartMs).toISOString().slice(0, 10);

  const summary = (token, range) =>
    request(app)
      .get(`/api/dashboard/sales-summary?range=${range}`)
      .set('Authorization', 'Bearer ' + token);

  const createTenant = async (label) => {
    const subdomain = `${prefix}${label}`;
    await db.query('DELETE FROM tenants WHERE subdomain = $1', [subdomain]);

    await request(app)
      .post('/api/auth/register-client')
      .send({
        businessName: `Local Window ${label}`,
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

  // One order + one item, revenue = opts.revenue, at createdAt (UTC wall).
  const insertOrder = async (tenantId, orderNo, createdAt, revenue) => {
    const product = await db.query(
      `INSERT INTO tbl_products (name, price, stock, tenant_id) VALUES ($1, $2, 100, $3) RETURNING id`,
      [`Window Product ${orderNo}`, revenue, tenantId]
    );
    const o = await db.query(
      `INSERT INTO tbl_orders (order_no, total, status, tenant_id, created_at)
       VALUES ($1, $2, 'Completed', $3, $4::timestamp) RETURNING or_id`,
      [`${prefix}${orderNo}`, revenue, tenantId, createdAt]
    );
    await db.query(
      `INSERT INTO tbl_order_items (order_id, product_id, qty, unit_price, subtotal, tenant_id, buy_price)
       VALUES ($1, $2, 1, $3, $3, $4, 10)`,
      [o.rows[0].or_id, product.rows[0].id, revenue, tenantId]
    );
    return o.rows[0].or_id;
  };

  beforeAll(async () => {
    const a = await createTenant('a');
    tokenA = a.token;
    tenantAId = a.tenantId;
    // A: exactly at the local day start -> inside range=today.
    await insertOrder(tenantAId, 'A', utcWall(dayStartUtcMs), 511);

    const b = await createTenant('b');
    tokenB = b.token;
    tenantBId = b.tenantId;
    // B: 30 minutes before the local day start -> outside range=today.
    await insertOrder(tenantBId, 'B', utcWall(dayStartUtcMs - 30 * 60 * 1000), 512);

    const c = await createTenant('c');
    tokenC = c.token;
    tenantCId = c.tenantId;
    // C: exactly at the local month start -> inside range=month.
    await insertOrder(tenantCId, 'C', utcWall(monthStartUtcMs), 513);

    const d = await createTenant('d');
    tokenD = d.token;
    tenantDId = d.tenantId;
    // D: 30 minutes before the local month start -> outside range=month.
    await insertOrder(tenantDId, 'D', utcWall(monthStartUtcMs - 30 * 60 * 1000), 514);
  });

  afterAll(async () => {
    await db.query('DELETE FROM tenants WHERE id IN ($1, $2, $3, $4)', [tenantAId, tenantBId, tenantCId, tenantDId]);
  });

  test('an order created exactly at the local day start is included in range=today', async () => {
    const res = await summary(tokenA, 'today');
    expect(res.status).toBe(200);
    expect(res.body.total_orders).toBe(1);
    expect(res.body.net_revenue).toBe(511);
  });

  test('an order created 30 minutes before the local day start is excluded from range=today', async () => {
    const res = await summary(tokenB, 'today');
    expect(res.status).toBe(200);
    expect(res.body.total_orders).toBe(0);
    expect(res.body.net_revenue).toBe(0);
  });

  test('an order created exactly at the local month start is included in range=month', async () => {
    const res = await summary(tokenC, 'month');
    expect(res.status).toBe(200);
    expect(res.body.total_orders).toBe(1);
    expect(res.body.net_revenue).toBe(513);
  });

  test('an order created 30 minutes before the local month start is excluded from range=month', async () => {
    const res = await summary(tokenD, 'month');
    expect(res.status).toBe(200);
    expect(res.body.total_orders).toBe(0);
    expect(res.body.net_revenue).toBe(0);
  });

  test('the today timeseries bucket labelled <local date> 00:00 carries the local-day-start order revenue', async () => {
    const res = await summary(tokenA, 'today');
    expect(res.status).toBe(200);

    const buckets = res.body.timeseries;
    expect(buckets.length).toBe(24);

    const firstBucket = buckets.find((t) => t.bucket === `${localDate} 00:00`);
    expect(firstBucket).toBeDefined();
    expect(firstBucket.revenue).toBe(511);
  });
});
