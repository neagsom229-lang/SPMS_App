const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/app');
const db = require('../src/config/postgres');
const { expectDenied } = require('./utils/expectDenied');

const runId = crypto.randomBytes(4).toString('hex');
const prefix = `tst2-${runId}-`;

describe('Security & Auth Test Suite', () => {
  let tokenA, tokenB, tenantAId, suspendedToken;
  let subA = prefix + 'a';
  let subB = prefix + 'b';
  let subSuspended = prefix + 'sus';
  let prodAId, custAId, suppAId, userAId, orderAId, orderA2Id;

  beforeAll(async () => {
    await db.query(`DELETE FROM tenants WHERE subdomain LIKE $1`, [prefix + '%']);

    const regA = await request(app).post('/api/auth/register-client').send({ businessName: subA, email: subA + '@test.com', password: 'Qa!123456', subdomain: subA });
    const loginA = await request(app).post('/api/auth/login').send({ username: subA + '_admin', password: 'Qa!123456' });
    tokenA = loginA.body.token || regA.body.token;

    const meA = await request(app).get('/api/auth/me').set('Authorization', 'Bearer ' + tokenA);
    tenantAId = meA.body.user.tenantId;

    const prodA = await request(app).post('/api/products').set('Authorization', 'Bearer ' + tokenA).send({ name: 'Prod A ' + runId, barcode: 'PA-' + runId, cost: 10, price: 20, stock: 50 });
    prodAId = prodA.body.id;

    const custA = await request(app).post('/api/customers').set('Authorization', 'Bearer ' + tokenA).send({ name: 'Cust A', phone: '011111111' });
    custAId = custA.body.id;

    const suppA = await request(app).post('/api/suppliers').set('Authorization', 'Bearer ' + tokenA).send({ name: 'Supp A', phone: '022222222' });
    suppAId = suppA.body.SUP_ID || suppA.body.id;

    const userA = await request(app).post('/api/users').set('Authorization', 'Bearer ' + tokenA).send({ username: prefix + 'userA', password: 'Qa!123456', role: 'cashier', fullname: 'User A', email: prefix + 'userA@test.com' });
    userAId = userA.body.user?.userid || userA.body.userid || userA.body.id;

    const orderA = await request(app).post('/api/orders').set('Authorization', 'Bearer ' + tokenA).send({ customer_id: custAId, items: [{ product_id: prodAId, qty: 1 }], payment_method: 'Cash', idempotency_key: crypto.randomUUID() });
    orderAId = orderA.body.or_id || orderA.body.id;

    // A second order, moved back to Pending so a real status transition exists.
    const orderA2 = await request(app).post('/api/orders').set('Authorization', 'Bearer ' + tokenA).send({ customer_id: custAId, items: [{ product_id: prodAId, qty: 1 }], payment_method: 'Cash', idempotency_key: crypto.randomUUID() });
    orderA2Id = orderA2.body.or_id || orderA2.body.id;
    await db.query(`UPDATE tbl_orders SET status = 'Pending' WHERE or_id = $1`, [orderA2Id]);

    const regB = await request(app).post('/api/auth/register-client').send({ businessName: subB, email: subB + '@test.com', password: 'Qa!123456', subdomain: subB });
    const loginB = await request(app).post('/api/auth/login').send({ username: subB + '_admin', password: 'Qa!123456' });
    tokenB = loginB.body.token || regB.body.token;

    const regSus = await request(app).post('/api/auth/register-client').send({ businessName: subSuspended, email: subSuspended + '@test.com', password: 'Qa!123456', subdomain: subSuspended });
    const loginSus = await request(app).post('/api/auth/login').send({ username: subSuspended + '_admin', password: 'Qa!123456' });
    suspendedToken = loginSus.body.token || regSus.body.token;

    await db.query(`UPDATE tenants SET status = 'suspended' WHERE subdomain = $1`, [subSuspended]);
  });

  afterAll(async () => {
    try {
      await db.query(`DELETE FROM tenants WHERE subdomain LIKE $1`, [prefix + '%']);
    } catch (e) {}
    await db.end();
  });

  test('Admin B cannot read Tenant A product by id', async () => {
    await expectDenied(app, {
      method: 'get',
      path: '/api/products/' + prodAId,
      deniedToken: tokenB,
      allowedToken: tokenA,
      status: 404,
      readRow: async () => (await db.query('SELECT name, price, status FROM tbl_products WHERE id = $1', [prodAId])).rows,
    });
  });

  test('Admin B cannot update Tenant A product', async () => {
    await expectDenied(app, {
      method: 'put',
      path: '/api/products/' + prodAId,
      deniedToken: tokenB,
      allowedToken: tokenA,
      body: { name: 'Hacked', price: 99 },
      status: 404,
      readRow: async () => (await db.query('SELECT name, price, status FROM tbl_products WHERE id = $1', [prodAId])).rows,
    });
  });

  test('Admin B cannot delete Tenant A product', async () => {
    const created = await request(app)
      .post('/api/products')
      .set('Authorization', 'Bearer ' + tokenA)
      .send({ name: 'Disposable ' + runId, barcode: 'DEL-' + runId, cost: 5, price: 10, stock: 1 });
    expect(created.status).toBe(201);
    const targetId = created.body.id;

    await expectDenied(app, {
      method: 'delete',
      path: '/api/products/' + targetId,
      deniedToken: tokenB,
      allowedToken: tokenA,
      status: 404,
      readRow: async () => (await db.query('SELECT status, is_published FROM tbl_products WHERE id = $1', [targetId])).rows,
    });
  });

  test('Admin B cannot PUT or DELETE Tenant A customer', async () => {
    await expectDenied(app, {
      method: 'put',
      path: '/api/customers/' + custAId,
      deniedToken: tokenB,
      allowedToken: tokenA,
      body: { name: 'Hacked' },
      status: 404,
      readRow: async () => (await db.query('SELECT name, status FROM tbl_customers WHERE id = $1', [custAId])).rows,
    });

    await expectDenied(app, {
      method: 'delete',
      path: '/api/customers/' + custAId,
      deniedToken: tokenB,
      allowedToken: tokenA,
      status: 404,
      readRow: async () => (await db.query('SELECT name, status FROM tbl_customers WHERE id = $1', [custAId])).rows,
    });
  });

  test('Admin B cannot PUT or DELETE Tenant A supplier', async () => {
    await expectDenied(app, {
      method: 'put',
      path: '/api/suppliers/' + suppAId,
      deniedToken: tokenB,
      allowedToken: tokenA,
      body: { sup_name: 'Hacked' },
      status: 404,
      readRow: async () => (await db.query('SELECT sup_name FROM tbl_suppliers WHERE id = $1', [suppAId])).rows,
    });

    await expectDenied(app, {
      method: 'delete',
      path: '/api/suppliers/' + suppAId,
      deniedToken: tokenB,
      allowedToken: tokenA,
      status: 404,
      readRow: async () => (await db.query('SELECT sup_name FROM tbl_suppliers WHERE id = $1', [suppAId])).rows,
    });
  });

  test('Admin B cannot PUT or DELETE Tenant A user', async () => {
    await expectDenied(app, {
      method: 'put',
      path: '/api/users/' + userAId,
      deniedToken: tokenB,
      allowedToken: tokenA,
      body: { role: 'admin' },
      status: 404,
      readRow: async () => (await db.query('SELECT role FROM tbl_users WHERE userid = $1', [userAId])).rows,
    });

    await expectDenied(app, {
      method: 'delete',
      path: '/api/users/' + userAId,
      deniedToken: tokenB,
      allowedToken: tokenA,
      status: 404,
      readRow: async () => (await db.query('SELECT userid FROM tbl_users WHERE userid = $1', [userAId])).rows,
    });
  });

  test('Admin B cannot PUT or DELETE Tenant A order', async () => {
    // The app has no PUT /api/orders/:id route; the old PUT half received the
    // generic route-404 for every caller, so it could not test isolation. The
    // real order mutation is PATCH /:id/status.
    await expectDenied(app, {
      method: 'patch',
      path: '/api/orders/' + orderA2Id + '/status',
      deniedToken: tokenB,
      allowedToken: tokenA,
      body: { status: 'Confirmed' },
      status: 404,
      readRow: async () => (await db.query('SELECT status FROM tbl_orders WHERE or_id = $1', [orderA2Id])).rows,
    });

    await expectDenied(app, {
      method: 'delete',
      path: '/api/orders/' + orderAId,
      deniedToken: tokenB,
      allowedToken: tokenA,
      body: { reason: 'Hacked' },
      status: 404,
      readRow: async () => (await db.query('SELECT status FROM tbl_orders WHERE or_id = $1', [orderAId])).rows,
    });
  });

  test('Spoofed X-Tenant-Id header cannot bypass tenant isolation for Admin B', async () => {
    await expectDenied(app, {
      method: 'get',
      path: '/api/products/' + prodAId,
      deniedToken: tokenB,
      allowedToken: tokenA,
      headers: { 'x-tenant-id': String(tenantAId) },
      status: 404,
      readRow: async () => (await db.query('SELECT name, price, status FROM tbl_products WHERE id = $1', [prodAId])).rows,
    });
  });

  test('Suspended tenant user real login returns 403', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: subSuspended + '_admin', password: 'Qa!123456' });
    expect(res.status).toBe(403);
  });

  test('Suspended tenant user existing token returns 403 on protected endpoint', async () => {
    await expectDenied(app, {
      method: 'get',
      path: '/api/products',
      deniedToken: suspendedToken,
      allowedToken: tokenA,
      status: 403,
    });
  });
});
