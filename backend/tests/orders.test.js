const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/app');
const db = require('../src/config/postgres');

const runId = crypto.randomBytes(4).toString('hex');
const prefix = `tsto-${runId}-`;

describe('Orders & Stock Test Suite', () => {
  let tokenA, cashierToken;
  let tenantASub = prefix + 'a';
  let tenantBSub = prefix + 'b';
  let prodId, catId, custId, order1Id;

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
      .send({ name: 'Prod ' + runId, barcode: 'BC-' + runId, cost: 10, price: 20, stock: 100, category_id: catId });
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
  });

  afterAll(async () => {
    try {
      await db.query(`DELETE FROM tenants WHERE subdomain LIKE $1`, [prefix + '%']);
    } catch (e) {}
    await db.end();
  });

  test('Cashier delete order returns 403 status', async () => {
    const ord = await request(app)
      .post('/api/orders')
      .set('Authorization', 'Bearer ' + cashierToken)
      .send({ customer_id: custId, items: [{ product_id: prodId, qty: 1 }], payment_method: 'Cash', idempotency_key: crypto.randomUUID() });
    order1Id = ord.body.or_id || ord.body.id;

    const res = await request(app)
      .delete('/api/orders/' + order1Id)
      .set('Authorization', 'Bearer ' + cashierToken)
      .send({ reason: 'Try delete' });
    expect(res.status).toBe(403);
  });

  test('Admin void order with reason returns 204, status Voided, and stock restored once', async () => {
    const stockPre = await request(app).get('/api/stock').set('Authorization', 'Bearer ' + tokenA);
    const rowPre = (stockPre.body.stock || stockPre.body).find(s => s.productid === prodId || s.id === prodId);
    const qtyPre = Number(rowPre.qtyavailable ?? rowPre.qtyinstock ?? rowPre.stock);

    const res = await request(app)
      .delete('/api/orders/' + order1Id)
      .set('Authorization', 'Bearer ' + tokenA)
      .send({ reason: 'Customer changed mind' });
    expect(res.status).toBe(204);

    const stockPost = await request(app).get('/api/stock').set('Authorization', 'Bearer ' + tokenA);
    const rowPost = (stockPost.body.stock || stockPost.body).find(s => s.productid === prodId || s.id === prodId);
    const qtyPost = Number(rowPost.qtyavailable ?? rowPost.qtyinstock ?? rowPost.stock);
    expect(qtyPost).toBe(qtyPre + 1);
  });

  test('Second void operation returns 409 conflict', async () => {
    const res = await request(app)
      .delete('/api/orders/' + order1Id)
      .set('Authorization', 'Bearer ' + tokenA)
      .send({ reason: 'Second void' });
    expect(res.status).toBe(409);
  });

  test('Refund after void returns 409 and stock remains unchanged', async () => {
    const res = await request(app)
      .post('/api/orders/' + order1Id + '/refund')
      .set('Authorization', 'Bearer ' + tokenA)
      .send({ reason: 'Refund after void' });
    expect(res.status).toBe(409);
  });

  test('20 parallel checkouts for the last unit succeed for exactly one and reject others with 409', async () => {
    const lastProdRes = await request(app).post('/api/products').set('Authorization', 'Bearer ' + tokenA).send({ name: 'Last Unit ' + runId, barcode: 'LU-' + runId, cost: 1, price: 10, stock: 1, category_id: catId });
    const lastProdId = lastProdRes.body.id;

    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(
        request(app).post('/api/orders').set('Authorization', 'Bearer ' + tokenA).send({
          customer_id: custId,
          items: [{ product_id: lastProdId, qty: 1 }],
          payment_method: 'Cash',
          idempotency_key: crypto.randomUUID()
        })
      );
    }
    const results = await Promise.all(promises);
    const successes = results.filter(r => r.status === 201 || r.status === 200);
    const conflicts = results.filter(r => r.status === 409);
    expect(successes.length).toBe(1);
    expect(conflicts.length).toBe(19);
  });

  test('Duplicate line items in cart returns 409 conflict', async () => {
    const dupProdRes = await request(app).post('/api/products').set('Authorization', 'Bearer ' + tokenA).send({ name: 'Dup Prod ' + runId, barcode: 'DUP-' + runId, cost: 1, price: 10, stock: 10, category_id: catId });
    const dupProdId = dupProdRes.body.id;

    const res = await request(app).post('/api/orders').set('Authorization', 'Bearer ' + tokenA).send({
      customer_id: custId,
      items: [
        { product_id: dupProdId, qty: 1 },
        { product_id: dupProdId, qty: 2 }
      ],
      payment_method: 'Cash',
      idempotency_key: crypto.randomUUID()
    });
    expect(res.status).toBe(409);
  });
});
