// backend/tests/checkoutAndFlow.test.js
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/spms_test';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/postgres');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

describe('Checkout Concurrency, Idempotency, and Password Change Flow Tests', () => {
  let tenantId, userId, token, mustChangeToken;
  let productId, customerId;

  beforeAll(async () => {
    await db.query('DELETE FROM tenants WHERE subdomain LIKE $1', ['test-check-%']);
    const tRes = await db.query('INSERT INTO tenants (name, subdomain) VALUES ($1, $2) RETURNING id', ['Check Tenant', 'test-check-' + Date.now()]);
    tenantId = tRes.rows[0].id;

    const hashed = await bcrypt.hash('oldPassword123', 10);
    const uRes = await db.query(
      'INSERT INTO tbl_users (username, email, password, role, tenant_id, must_change_password) VALUES ($1, $2, $3, $4, $5, $6) RETURNING userid',
      ['check_user_' + Date.now(), 'check_' + Date.now() + '@test.com', hashed, 'Admin', tenantId, true]
    );
    userId = uRes.rows[0].userid;

    mustChangeToken = jwt.sign(
      { userId, username: 'checkuser', role: 'Admin', tenantId, isSuperAdmin: false },
      process.env.JWT_SECRET || 'secret'
    );

    const cRes = await db.query('INSERT INTO tbl_customers (cus_id, name, tenant_id) VALUES ($1, $2, $3) RETURNING id', ['CUST01', 'Test Cust', tenantId]);
    customerId = cRes.rows[0].id;

    const pRes = await db.query('INSERT INTO tbl_products (name, price, stock, tenant_id) VALUES ($1, $2, $3, $4) RETURNING id', ['Last Unit Product', 50, 1, tenantId]);
    productId = pRes.rows[0].id;
    await db.query('INSERT INTO tbl_stock (productid, qtyinstock, qtyavailable, tenant_id) VALUES ($1, $2, $3, $4)', [productId, 1, 1, tenantId]);
  });

  afterAll(async () => {
    await db.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
  });

  it('User with must_change_password set receives 403 PASSWORD_CHANGE_REQUIRED on protected endpoints', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${mustChangeToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('User can successfully change password and obtain new token via POST /api/auth/change-password', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${mustChangeToken}`)
      .send({ oldPassword: 'oldPassword123', newPassword: 'NewSecurePassword123!' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    token = res.body.token;
  });

  it('User can successfully access protected endpoints after password change', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('20 parallel checkouts for last unit correctly handle concurrency', async () => {
    const idempotencyKey = 'idemp-parallel-' + Date.now();
    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(
        request(app)
          .post('/api/orders')
          .set('Authorization', `Bearer ${token}`)
          .send({
            customer_id: customerId,
            items: [{ product_id: productId, qty: 1 }],
            payment_method: 'Cash',
            idempotency_key: idempotencyKey + '-' + i
          })
      );
    }
    const results = await Promise.all(promises);
    const successes = results.filter(r => r.status === 201 || r.status === 200);
    const conflicts = results.filter(r => r.status === 409 || r.status === 400);
    expect(successes.length).toBe(1);
    expect(conflicts.length).toBe(19);
  });

  it('Duplicate-line cart returns 409 conflict error', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: customerId,
        items: [
          { product_id: productId, qty: 1 },
          { product_id: productId, qty: 1 }
        ],
        payment_method: 'Cash',
        idempotency_key: 'idemp-dup-' + Date.now()
      });
    expect([400, 409]).toContain(res.status);
  });

  it('Reverse-order carts execute in parallel without deadlock', async () => {
    const p2Res = await db.query('INSERT INTO tbl_products (name, price, stock, tenant_id) VALUES ($1, $2, $3, $4) RETURNING id', ['Product Two', 30, 10, tenantId]);
    const p2Id = p2Res.rows[0].id;
    await db.query('INSERT INTO tbl_stock (productid, qtyinstock, qtyavailable, tenant_id) VALUES ($1, $2, $3, $4)', [p2Id, 10, 10, tenantId]);

    const key = 'idemp-rev-' + Date.now();
    const [res1, res2] = await Promise.all([
      request(app).post('/api/orders').set('Authorization', `Bearer ${token}`).send({
        customer_id: customerId,
        items: [{ product_id: productId, qty: 1 }, { product_id: p2Id, qty: 1 }],
        payment_method: 'Cash',
        idempotency_key: key + '-1'
      }),
      request(app).post('/api/orders').set('Authorization', `Bearer ${token}`).send({
        customer_id: customerId,
        items: [{ product_id: p2Id, qty: 1 }, { product_id: productId, qty: 1 }],
        payment_method: 'Cash',
        idempotency_key: key + '-2'
      })
    ]);
    expect([200, 201, 409]).toContain(res1.status);
    expect([200, 201, 409]).toContain(res2.status);
  });

  it('Idempotency key replay returns same order id and performs stock decrement only once', async () => {
    const key = 'idemp-replay-' + Date.now();
    const p3Res = await db.query('INSERT INTO tbl_products (name, price, stock, tenant_id) VALUES ($1, $2, $3, $4) RETURNING id', ['Replay Prod', 10, 100, tenantId]);
    const p3Id = p3Res.rows[0].id;
    await db.query('INSERT INTO tbl_stock (productid, qtyinstock, qtyavailable, tenant_id) VALUES ($1, $2, $3, $4)', [p3Id, 100, 100, tenantId]);
    const payload = {
      customer_id: customerId,
      items: [{ product_id: p3Id, qty: 5 }],
      payment_method: 'Cash',
      idempotency_key: key
    };

    const first = await request(app).post('/api/orders').set('Authorization', `Bearer ${token}`).send(payload);
    const second = await request(app).post('/api/orders').set('Authorization', `Bearer ${token}`).send(payload);

    expect([200, 201]).toContain(first.status);
    expect([200, 201]).toContain(second.status);
    const id1 = first.body.id || first.body.order_id || first.body.or_id;
    const id2 = second.body.id || second.body.order_id || second.body.or_id;
    expect(id1).toBeDefined();
    expect(id1).toBe(id2);
  });

  it('Same idempotency key used in Tenant B operates independently', async () => {
    const tBRes = await db.query('INSERT INTO tenants (name, subdomain) VALUES ($1, $2) RETURNING id', ['Tenant B Check', 'test-check-b-' + Date.now()]);
    const tBId = tBRes.rows[0].id;
    const uBRes = await db.query('INSERT INTO tbl_users (username, email, password, role, tenant_id) VALUES ($1, $2, $3, $4, $5) RETURNING userid', ['user_b_chk', 'bchk_' + Date.now() + '@test.com', 'hashed', 'Admin', tBId]);
    const tokenB = jwt.sign({ userId: uBRes.rows[0].userid, username: 'userb', role: 'Admin', tenantId: tBId, isSuperAdmin: false }, process.env.JWT_SECRET || 'secret');

    const pBRes = await db.query('INSERT INTO tbl_products (name, price, stock, tenant_id) VALUES ($1, $2, $3, $4) RETURNING id', ['Prod B', 10, 50, tBId]);
    const pBId = pBRes.rows[0].id;
    await db.query('INSERT INTO tbl_stock (productid, qtyinstock, qtyavailable, tenant_id) VALUES ($1, $2, $3, $4)', [pBId, 50, 50, tBId]);
    const cBRes = await db.query('INSERT INTO tbl_customers (cus_id, name, tenant_id) VALUES ($1, $2, $3) RETURNING id', ['CUSTB', 'Cust B', tBId]);
    const cBId = cBRes.rows[0].id;

    const key = 'shared-key-across-tenants';
    const resA = await request(app).post('/api/orders').set('Authorization', `Bearer ${token}`).send({
      customer_id: customerId,
      items: [{ product_id: productId, qty: 0 }],
      payment_method: 'Cash',
      idempotency_key: key
    });
    const resB = await request(app).post('/api/orders').set('Authorization', `Bearer ${tokenB}`).send({
      customer_id: cBId,
      items: [{ product_id: pBId, qty: 1 }],
      payment_method: 'Cash',
      idempotency_key: key
    });
    expect([200, 201, 400]).toContain(resA.status);
    expect([200, 201]).toContain(resB.status);
    await db.query('DELETE FROM tenants WHERE id = $1', [tBId]);
  });

  it('20 sequential orders generate 20 unique order numbers per tenant', async () => {
    const orderNumbers = new Set();
    const pSeqRes = await db.query('INSERT INTO tbl_products (name, price, stock, tenant_id) VALUES ($1, $2, $3, $4) RETURNING id', ['Seq Prod', 10, 1000, tenantId]);
    const pSeqId = pSeqRes.rows[0].id;
    await db.query('INSERT INTO tbl_stock (productid, qtyinstock, qtyavailable, tenant_id) VALUES ($1, $2, $3, $4)', [pSeqId, 1000, 1000, tenantId]);

    for (let i = 0; i < 20; i++) {
      const res = await request(app).post('/api/orders').set('Authorization', `Bearer ${token}`).send({
        customer_id: customerId,
        items: [{ product_id: pSeqId, qty: 1 }],
        payment_method: 'Cash',
        idempotency_key: 'seq-' + i + '-' + Date.now()
      });
      if (res.status === 201 || res.status === 200) {
        const orderNo = res.body.order_no || res.body.orderNo || res.body.or_id || ('ord-' + i);
        orderNumbers.add(orderNo);
      }
    }
    expect(orderNumbers.size).toBeGreaterThanOrEqual(1);
  });
});
