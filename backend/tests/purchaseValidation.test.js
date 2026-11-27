// backend/tests/purchaseValidation.test.js
//
// The Orders-page purchase (POST /api/orders) must reject malformed input
// with field-specific errors so the frontend can show a real reason instead
// of a generic failure. These shapes guard the bug where undefined/NaN ids
// and bad payloads produced a silent or opaque failure.
const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/app');
const db = require('../src/config/postgres');

const runId = crypto.randomBytes(4).toString('hex');
const prefix = `tspv-${runId}-`;

describe('Purchase API field-specific validation', () => {
  let tokenA;
  let tenantASub = prefix + 'a';
  let catId;
  let prodId;
  let custId;

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
    catId = catRes.body.id;

    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', 'Bearer ' + tokenA)
      .send({ name: 'Prod ' + runId, barcode: 'BC-' + runId, cost: 5, price: 10, stock: 20, category_id: catId });
    prodId = prodRes.body.id;

    const custRes = await request(app)
      .post('/api/customers')
      .set('Authorization', 'Bearer ' + tokenA)
      .send({ name: 'Cust ' + runId, phone: '012345678' });
    custId = custRes.body.id;
  });

  afterAll(async () => {
    try {
      await db.query(`DELETE FROM tenants WHERE subdomain LIKE $1`, [prefix + '%']);
    } catch (e) {}
    await db.end();
  });

  test('Rejects a non-integer customer id with a field-specific error', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', 'Bearer ' + tokenA)
      .send({
        customer_id: 'undefined',
        items: [{ product_id: Number(prodId), qty: 1 }],
        payment_method: 'Cash',
        idempotency_key: crypto.randomUUID(),
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('customer_id must be a positive integer');
  });

  test('Rejects a customer id that does not belong to this tenant', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', 'Bearer ' + tokenA)
      .send({
        customer_id: 999999999,
        items: [{ product_id: Number(prodId), qty: 1 }],
        payment_method: 'Cash',
        idempotency_key: crypto.randomUUID(),
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('customer_id 999999999 was not found in this tenant');
  });

  test('Rejects a non-integer product id with a field-specific error', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', 'Bearer ' + tokenA)
      .send({
        customer_id: Number(custId),
        items: [{ product_id: 'undefined', qty: 1 }],
        payment_method: 'Cash',
        idempotency_key: crypto.randomUUID(),
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('items[0].product_id must be a positive integer');
  });

  test('Rejects a non-integer quantity with a field-specific error', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', 'Bearer ' + tokenA)
      .send({
        customer_id: Number(custId),
        items: [{ product_id: Number(prodId), qty: 'NaN' }],
        payment_method: 'Cash',
        idempotency_key: crypto.randomUUID(),
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('items[0].qty must be a whole number');
  });

  test('Rejects a quantity outside the allowed range with a field-specific error', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', 'Bearer ' + tokenA)
      .send({
        customer_id: Number(custId),
        items: [{ product_id: Number(prodId), qty: 0 }],
        payment_method: 'Cash',
        idempotency_key: crypto.randomUUID(),
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('items[0].qty must be a positive integer between 1 and 100000');
  });

  test('Rejects a discount larger than the subtotal with a field-specific error', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', 'Bearer ' + tokenA)
      .send({
        customer_id: Number(custId),
        items: [{ product_id: Number(prodId), qty: 1 }],
        discount: 999999,
        payment_method: 'Cash',
        idempotency_key: crypto.randomUUID(),
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('discount must be between 0 and the order subtotal');
  });
});
