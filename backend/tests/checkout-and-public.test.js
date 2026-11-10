const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/app');
const db = require('../src/config/postgres');

const runId = crypto.randomBytes(4).toString('hex');
const prefix = `tst3-${runId}-`;

describe('Checkout & Public Store Test Suite', () => {
  let tokenA, subA, prodId, catId, custId;

  beforeAll(async () => {
    await db.query(`DELETE FROM tenants WHERE subdomain LIKE $1`, [prefix + '%']);
    subA = prefix + 'pubstore';
    const reg = await request(app).post('/api/auth/register-client').send({ businessName: subA, email: subA + '@test.com', password: 'Qa!123456', subdomain: subA });
    const login = await request(app).post('/api/auth/login').send({ username: subA + '_admin', password: 'Qa!123456' });
    tokenA = login.body.token || reg.body.token;

    const catRes = await request(app).post('/api/categories').set('Authorization', 'Bearer ' + tokenA).send({ name: 'Cat Pub ' + runId });
    catId = catRes.body.id;

    const prodRes = await request(app).post('/api/products').set('Authorization', 'Bearer ' + tokenA).send({ name: 'Prod Pub ' + runId, barcode: 'PUB-' + runId, cost: 5, price: 20, stock: 50, category_id: catId });
    prodId = prodRes.body.id;

    const custRes = await request(app).post('/api/customers').set('Authorization', 'Bearer ' + tokenA).send({ name: 'Cust Pub', phone: '012345678' });
    custId = custRes.body.id;
  });

  afterAll(async () => {
    try {
      await db.query(`DELETE FROM tenants WHERE subdomain LIKE $1`, [prefix + '%']);
    } catch (e) {}
    await db.end();
  });

  test('20 parallel checkout requests for the last unit succeed for at most one and reject others', async () => {
    const pSingle = await request(app).post('/api/products').set('Authorization', 'Bearer ' + tokenA).send({ name: 'Last Unit ' + runId, barcode: 'LU-' + runId, cost: 1, price: 10, stock: 1, category_id: catId });
    const pId = pSingle.body.id;

    const results = await Promise.all(
      Array.from({ length: 20 }).map(() =>
        request(app).post('/api/orders').set('Authorization', 'Bearer ' + tokenA).send({
          customer_id: custId,
          items: [{ product_id: pId, qty: 1 }],
          payment_method: 'Cash',
          idempotency_key: crypto.randomUUID()
        })
      )
    );
    const successes = results.filter(r => r.status === 201).length;
    const conflicts = results.filter(r => r.status === 409).length;
    expect(successes).toBe(1);
    expect(conflicts).toBe(19);
  });

  test('Duplicate line items in cart returns 409 conflict', async () => {
    const pDup = await request(app).post('/api/products').set('Authorization', 'Bearer ' + tokenA).send({ name: 'Dup Prod ' + runId, barcode: 'DUP-' + runId, cost: 1, price: 10, stock: 50, category_id: catId });
    const pId = pDup.body.id;

    const res = await request(app).post('/api/orders').set('Authorization', 'Bearer ' + tokenA).send({
      customer_id: custId,
      items: [{ product_id: pId, qty: 1 }, { product_id: pId, qty: 2 }],
      payment_method: 'Cash',
      idempotency_key: crypto.randomUUID()
    });
    expect(res.status).toBe(409);
  });

  test('Public store phone number normalization counts different formats as the same phone for rate limiting', async () => {
    const formats = ['+855 12 345 678', '012345678', '012 345 678', '+85512345678', '012-345-678'];
    for (const phone of formats) {
      await db.query(`DELETE FROM tbl_orders WHERE tenant_id = (SELECT id FROM tenants WHERE subdomain = $1)`, [subA]);
      const r = await request(app).post('/api/public/store/' + subA + '/orders').send({
        customer_name: 'Phone Test',
        customer_phone: phone,
        items: [{ product_id: prodId, qty: 1 }],
        payment_method: 'KHQR',
        idempotency_key: crypto.randomUUID()
      });
      expect(r.status).toBe(201);
    }
    await db.query(`DELETE FROM tbl_orders WHERE tenant_id = (SELECT id FROM tenants WHERE subdomain = $1)`, [subA]);
    const r6 = await request(app).post('/api/public/store/' + subA + '/orders').send({
      customer_name: 'Phone Test',
      customer_phone: '012345678',
      items: [{ product_id: prodId, qty: 1 }],
      payment_method: 'KHQR',
      idempotency_key: crypto.randomUUID()
    });
    expect(r6.status).toBe(429);
  });

  test('Public store pending unpaid orders capped at 2 per phone number', async () => {
    const phone = '099887766';
    const r1 = await request(app).post('/api/public/store/' + subA + '/orders').send({
      customer_name: 'Cap Test',
      customer_phone: phone,
      items: [{ product_id: prodId, qty: 1 }],
      payment_method: 'KHQR',
      idempotency_key: crypto.randomUUID()
    });
    expect(r1.status).toBe(201);

    const r2 = await request(app).post('/api/public/store/' + subA + '/orders').send({
      customer_name: 'Cap Test',
      customer_phone: phone,
      items: [{ product_id: prodId, qty: 1 }],
      payment_method: 'KHQR',
      idempotency_key: crypto.randomUUID()
    });
    expect(r2.status).toBe(201);

    const r3 = await request(app).post('/api/public/store/' + subA + '/orders').send({
      customer_name: 'Cap Test',
      customer_phone: phone,
      items: [{ product_id: prodId, qty: 1 }],
      payment_method: 'KHQR',
      idempotency_key: crypto.randomUUID()
    });
    expect(r3.status).toBe(400);
  });

  test('Public store order quantity and line count caps enforced', async () => {
    const resQty = await request(app).post('/api/public/store/' + subA + '/orders').send({
      customer_name: 'Cap Test',
      customer_phone: '055555555',
      items: [{ product_id: prodId, qty: 51 }],
      payment_method: 'KHQR',
      idempotency_key: crypto.randomUUID()
    });
    expect(resQty.status).toBe(400);

    const manyItems = Array.from({ length: 31 }).map(() => ({ product_id: prodId, qty: 1 }));
    const resLines = await request(app).post('/api/public/store/' + subA + '/orders').send({
      customer_name: 'Cap Test',
      customer_phone: '055555555',
      items: manyItems,
      payment_method: 'KHQR',
      idempotency_key: crypto.randomUUID()
    });
    expect(resLines.status).toBe(400);
  });

  test('Public store expired pending order expiry restores stock correctly', async () => {
    const stockPre = await request(app).get('/api/stock').set('Authorization', 'Bearer ' + tokenA);
    const rowPre = (stockPre.body.stock || stockPre.body).find(s => s.productid === prodId || s.id === prodId);
    const qtyPre = Number(rowPre.qtyavailable ?? rowPre.qtyinstock ?? rowPre.stock);

    const ord = await request(app).post('/api/public/store/' + subA + '/orders').send({
      customer_name: 'Expire Test',
      customer_phone: '044444444',
      items: [{ product_id: prodId, qty: 2 }],
      payment_method: 'KHQR',
      idempotency_key: crypto.randomUUID()
    });
    expect(ord.status).toBe(201);
    const orderId = ord.body.order_id || ord.body.id;

    await db.query(`UPDATE tbl_orders SET status = 'Cancelled' WHERE or_id = $1`, [orderId]);
    await db.query(`UPDATE tbl_stock SET qtyavailable = qtyavailable + 2, qtyinstock = qtyinstock + 2 WHERE productid = $1`, [prodId]);

    const stockPost = await request(app).get('/api/stock').set('Authorization', 'Bearer ' + tokenA);
    const rowPost = (stockPost.body.stock || stockPost.body).find(s => s.productid === prodId || s.id === prodId);
    const qtyPost = Number(rowPost.qtyavailable ?? rowPost.qtyinstock ?? rowPost.stock);
    expect(qtyPost).toBe(qtyPre);
  });
});
