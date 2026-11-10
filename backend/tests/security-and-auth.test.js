const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/app');
const db = require('../src/config/postgres');

const runId = crypto.randomBytes(4).toString('hex');
const prefix = `tst2-${runId}-`;

describe('Security & Auth Test Suite', () => {
  let tokenA, tokenB, tenantAId, suspendedToken;
  let subA = prefix + 'a';
  let subB = prefix + 'b';
  let subSuspended = prefix + 'sus';
  let prodAId, custAId, suppAId, userAId, orderAId;

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
    const res = await request(app).get('/api/products/' + prodAId).set('Authorization', 'Bearer ' + tokenB);
    expect([403, 404]).toContain(res.status);
  });

  test('Admin B cannot update Tenant A product', async () => {
    const res = await request(app).put('/api/products/' + prodAId).set('Authorization', 'Bearer ' + tokenB).send({ name: 'Hacked', price: 99 });
    expect([403, 404]).toContain(res.status);
  });

  test('Admin B cannot delete Tenant A product', async () => {
    const res = await request(app).delete('/api/products/' + prodAId).set('Authorization', 'Bearer ' + tokenB);
    expect([403, 404]).toContain(res.status);
  });

  test('Admin B cannot PUT or DELETE Tenant A customer', async () => {
    const putRes = await request(app).put('/api/customers/' + custAId).set('Authorization', 'Bearer ' + tokenB).send({ name: 'Hacked' });
    expect([403, 404]).toContain(putRes.status);
    const delRes = await request(app).delete('/api/customers/' + custAId).set('Authorization', 'Bearer ' + tokenB);
    expect([403, 404]).toContain(delRes.status);
  });

  test('Admin B cannot PUT or DELETE Tenant A supplier', async () => {
    const putRes = await request(app).put('/api/suppliers/' + suppAId).set('Authorization', 'Bearer ' + tokenB).send({ sup_name: 'Hacked' });
    expect([403, 404]).toContain(putRes.status);
    const delRes = await request(app).delete('/api/suppliers/' + suppAId).set('Authorization', 'Bearer ' + tokenB);
    expect([403, 404]).toContain(delRes.status);
  });

  test('Admin B cannot PUT or DELETE Tenant A user', async () => {
    const putRes = await request(app).put('/api/users/' + userAId).set('Authorization', 'Bearer ' + tokenB).send({ role: 'admin' });
    expect([403, 404]).toContain(putRes.status);
    const delRes = await request(app).delete('/api/users/' + userAId).set('Authorization', 'Bearer ' + tokenB);
    expect([403, 404]).toContain(delRes.status);
  });

  test('Admin B cannot PUT or DELETE Tenant A order', async () => {
    const putRes = await request(app).put('/api/orders/' + orderAId).set('Authorization', 'Bearer ' + tokenB).send({ status: 'Cancelled' });
    expect([403, 404]).toContain(putRes.status);
    const delRes = await request(app).delete('/api/orders/' + orderAId).set('Authorization', 'Bearer ' + tokenB).send({ reason: 'Hacked' });
    expect([403, 404]).toContain(delRes.status);
  });

  test('Spoofed X-Tenant-Id header cannot bypass tenant isolation for Admin B', async () => {
    const res = await request(app).get('/api/products/' + prodAId).set('Authorization', 'Bearer ' + tokenB).set('x-tenant-id', String(tenantAId));
    expect([403, 404]).toContain(res.status);
  });

  test('Suspended tenant user real login returns 403', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: subSuspended + '_admin', password: 'Qa!123456' });
    expect(res.status).toBe(403);
  });

  test('Suspended tenant user existing token returns 403 on protected endpoint', async () => {
    const res = await request(app).get('/api/products').set('Authorization', 'Bearer ' + suspendedToken);
    expect(res.status).toBe(403);
  });
});
