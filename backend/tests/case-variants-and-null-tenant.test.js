const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/app');
const db = require('../src/config/postgres');
const { expectDenied } = require('./utils/expectDenied');

const runId = crypto.randomBytes(4).toString('hex');
const prefix = `tst1-${runId}-`;

describe('Case Variants & Null Tenant Test Suite', () => {
  let tokenA, cashierToken;
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
  });

  afterAll(async () => {
    try {
      await db.query(`DELETE FROM tenants WHERE subdomain LIKE $1`, [prefix + '%']);
    } catch (e) {}
    await db.end();
  });

  test('Cashier case-variant DELETE /api/orders/:id returns 403', async () => {
    await expectDenied(app, {
      method: 'delete',
      path: `/api/orders/${order1Id}`,
      deniedToken: cashierToken,
      allowedToken: tokenA,
      body: { reason: 'Test' },
      status: 403,
      readRow: async () => (await db.query(
        'SELECT status, voided_at, void_reason, updated_at FROM tbl_orders WHERE or_id = $1',
        [order1Id]
      )).rows,
    });
  });
});
