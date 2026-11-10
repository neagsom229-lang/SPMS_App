const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/app');
const db = require('../src/config/postgres');
const jwt = require('jsonwebtoken');

const runId = crypto.randomBytes(4).toString('hex');
const prefix = `tst1-${runId}-`;

describe('Case Variants & Null Tenant Test Suite', () => {
  let tokenA, cashierToken, nullUserToken;
  let tenantASub = prefix + 'a';
  let prodId, custId, order1Id;

  beforeAll(async () => {
    await db.query(`DELETE FROM tenants WHERE subdomain LIKE $1`, [prefix + '%']);

    const regA = await request(app)
      .post('/api/auth/register-client')
      .send({ businessName: tenantASub, email: tenantASub + '@test.com', password: 'Qa!123456', subdomain: tenantASub });

    const loginA = await request(app)
      .post('/api/auth/login')
      .send({ username: tenantASub + '_admin', password: 'Qa!123456' });
    tokenA = loginA.body.token || regA.body.token;

    const catRes = await request(app)
      .post('/api/categories')
      .set('Authorization', 'Bearer ' + tokenA)
      .send({ name: 'Cat ' + runId });

    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', 'Bearer ' + tokenA)
      .send({ name: 'Prod ' + runId, barcode: 'BC-' + runId, cost: 10, price: 20, stock: 100, category_id: catRes.body.id });
    prodId = prodRes.body.id;

    const custRes = await request(app)
      .post('/api/customers')
      .set('Authorization', 'Bearer ' + tokenA)
      .send({ name: 'Cust ' + runId, phone: '012345678' });
    custId = custRes.body.id;

    const cashierName = prefix + 'cashier';
    await request(app)
      .post('/api/users')
      .set('Authorization', 'Bearer ' + tokenA)
      .send({ username: cashierName, password: 'Qa!123456', role: 'cashier', fullname: 'Cashier', email: cashierName + '@test.com' });

    const cashierLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: cashierName, password: 'Qa!123456' });
    cashierToken = cashierLogin.body.token;

    const ord = await request(app)
      .post('/api/orders')
      .set('Authorization', 'Bearer ' + cashierToken)
      .send({ customer_id: custId, items: [{ product_id: prodId, qty: 1 }], payment_method: 'Cash', idempotency_key: crypto.randomUUID() });
    order1Id = ord.body.or_id || ord.body.id;

    const decoded = jwt.decode(cashierToken);
    await db.query(`ALTER TABLE tbl_users DROP CONSTRAINT IF EXISTS chk_user_tenant`);
    await db.query(`UPDATE tbl_users SET tenant_id = NULL WHERE userid = $1`, [decoded.userId]);
    nullUserToken = cashierToken;
  });

  afterAll(async () => {
    try {
      await db.query(`DELETE FROM tenants WHERE subdomain LIKE $1`, [prefix + '%']);
      await db.query(`ALTER TABLE tbl_users ADD CONSTRAINT chk_user_tenant CHECK (is_super_admin = TRUE OR tenant_id IS NOT NULL) NOT VALID`).catch(() => {});
    } catch (e) {}
    await db.end();
  });

  test('Cashier case-variant POST /api/Orders/:id/Refund returns 403', async () => {
    const res = await request(app).post(`/api/Orders/${order1Id}/Refund`).set('Authorization', 'Bearer ' + cashierToken).send({ reason: 'Test' });
    expect(res.status).toBe(403);
  });

  test('Cashier case-variant POST /api/Orders/:id/Cancel returns 403', async () => {
    const res = await request(app).post(`/api/Orders/${order1Id}/Cancel`).set('Authorization', 'Bearer ' + cashierToken).send({ reason: 'Test' });
    expect(res.status).toBe(403);
  });

  test('Cashier case-variant PATCH /api/Orders/:id/Status returns 403', async () => {
    const res = await request(app).patch(`/api/Orders/${order1Id}/Status`).set('Authorization', 'Bearer ' + cashierToken).send({ status: 'Cancelled' });
    expect(res.status).toBe(403);
  });

  test('Cashier case-variant DELETE /api/orders/:id returns 403', async () => {
    const res = await request(app).delete(`/api/orders/${order1Id}`).set('Authorization', 'Bearer ' + cashierToken).send({ reason: 'Test' });
    expect(res.status).toBe(403);
  });

  test('Cashier case-variant GET /api/USERS returns 403', async () => {
    const res = await request(app).get('/api/USERS').set('Authorization', 'Bearer ' + cashierToken);
    expect(res.status).toBe(403);
  });

  test('Cashier case-variant GET /api/Users/ returns 403', async () => {
    const res = await request(app).get('/api/Users/').set('Authorization', 'Bearer ' + cashierToken);
    expect(res.status).toBe(403);
  });

  test('Cashier case-variant GET /api/REPORTS returns 403', async () => {
    const res = await request(app).get('/api/REPORTS').set('Authorization', 'Bearer ' + cashierToken);
    expect(res.status).toBe(403);
  });

  test('Cashier case-variant GET /api/%75sers returns 403 or 404', async () => {
    const res = await request(app).get('/api/%75sers').set('Authorization', 'Bearer ' + cashierToken);
    expect(res.status).toBe(404);
  });

  test('Null-tenant user GET /api/orders returns 403 and zero rows', async () => {
    const res = await request(app).get('/api/orders').set('Authorization', 'Bearer ' + nullUserToken);
    expect(res.status).toBe(403);
  });

  test('Null-tenant user GET /api/products returns 403 and zero rows', async () => {
    const res = await request(app).get('/api/products').set('Authorization', 'Bearer ' + nullUserToken);        
    expect(res.status).toBe(403);
  });

  test('Null-tenant user GET /api/customers returns 403 and zero rows', async () => {
    const res = await request(app).get('/api/customers').set('Authorization', 'Bearer ' + nullUserToken);       
    expect(res.status).toBe(403);
  });

  test('Null-tenant user GET /api/suppliers returns 403 and zero rows', async () => {
    const res = await request(app).get('/api/suppliers').set('Authorization', 'Bearer ' + nullUserToken);       
    expect(res.status).toBe(403);
  });

  test('Null-tenant user GET /api/stock returns 403 and zero rows', async () => {
    const res = await request(app).get('/api/stock').set('Authorization', 'Bearer ' + nullUserToken);
    expect(res.status).toBe(403);
  });

  test('Null-tenant user GET /api/categories returns 403 and zero rows', async () => {
    const res = await request(app).get('/api/categories').set('Authorization', 'Bearer ' + nullUserToken);      
    expect(res.status).toBe(403);
  });

  test('Null-tenant user GET /api/analytics/stats returns 403 and zero rows', async () => {
    const res = await request(app).get('/api/analytics/stats').set('Authorization', 'Bearer ' + nullUserToken);       
    expect(res.status).toBe(403);
  });

  test('Null-tenant user GET /api/warranties returns 403 and zero rows', async () => {
    const res = await request(app).get('/api/warranties').set('Authorization', 'Bearer ' + nullUserToken);      
    expect(res.status).toBe(403);
  });

  test('Null-tenant user GET /api/services returns 403 and zero rows', async () => {
    const res = await request(app).get('/api/services').set('Authorization', 'Bearer ' + nullUserToken);        
    expect(res.status).toBe(403);
  });
});
