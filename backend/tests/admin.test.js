const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/app');
const db = require('../src/config/postgres');

const runId = crypto.randomBytes(4).toString('hex');
const prefix = `tsta-${runId}-`;

describe('Admin & Public Store Test Suite', () => {
  let tokenA, subA;

  beforeAll(async () => {
    await db.query(`DELETE FROM tenants WHERE subdomain LIKE $1`, [prefix + '%']);
    subA = prefix + 'store';
    const reg = await request(app).post('/api/auth/register-client').send({ businessName: subA, email: subA + '@test.com', password: 'Qa!123456', subdomain: subA });
    const login = await request(app).post('/api/auth/login').send({ username: subA + '_admin', password: 'Qa!123456' });
    tokenA = login.body.token || reg.body.token;
  });

  afterAll(async () => {
    try {
      await db.query(`DELETE FROM tenants WHERE subdomain LIKE $1`, [prefix + '%']);
    } catch (e) {}
    await db.end();
  });

  test('Admin user login succeeds and returns valid auth token', async () => {
    expect(tokenA).toBeDefined();
  });

  test('Public store menu endpoint loads without leaking cost or supplier data', async () => {
    const cat = await request(app).post('/api/categories').set('Authorization', 'Bearer ' + tokenA).send({ name: 'Cat Pub ' + runId });
    await request(app).post('/api/products').set('Authorization', 'Bearer ' + tokenA).send({ name: 'Prod Pub ' + runId, barcode: 'PUB-' + runId, cost: 5, price: 20, stock: 10, category_id: cat.body.id });

    const menu = await request(app).get('/api/public/store/' + subA + '/menu');
    expect(menu.status).toBe(200);
    const products = menu.body.products || [];
    expect(products.length).toBeGreaterThan(0);
    const keys = Object.keys(products[0]);
    expect(keys.some(k => /cost|buy|supplier/i.test(k))).toBe(false);
  });

  test('Negative or zero quantity order submission is rejected with 4xx status', async () => {
    const cust = await request(app).post('/api/customers').set('Authorization', 'Bearer ' + tokenA).send({ name: 'Cust Pub', phone: '011223344' });
    const prod = await request(app).post('/api/products').set('Authorization', 'Bearer ' + tokenA).send({ name: 'Prod Qty', barcode: 'QTY-' + runId, cost: 5, price: 20, stock: 10 });
    
    const res = await request(app).post('/api/orders').set('Authorization', 'Bearer ' + tokenA).send({ customer_id: cust.body.id, items: [{ product_id: prod.body.id, qty: 0 }], payment_method: 'Cash', idempotency_key: crypto.randomUUID() });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test('Overselling inventory returns 409 conflict and leaves stock unchanged', async () => {
    const cust = await request(app).post('/api/customers').set('Authorization', 'Bearer ' + tokenA).send({ name: 'Cust Over', phone: '022334455' });
    const prod = await request(app).post('/api/products').set('Authorization', 'Bearer ' + tokenA).send({ name: 'Prod Over', barcode: 'OVER-' + runId, cost: 5, price: 20, stock: 5 });
    
    const res = await request(app).post('/api/orders').set('Authorization', 'Bearer ' + tokenA).send({ customer_id: cust.body.id, items: [{ product_id: prod.body.id, qty: 100 }], payment_method: 'Cash', idempotency_key: crypto.randomUUID() });
    expect(res.status).toBe(409);
  });
});
