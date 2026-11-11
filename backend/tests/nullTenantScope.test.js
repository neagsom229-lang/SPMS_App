// backend/tests/nullTenantScope.test.js
process.env.NODE_ENV = 'test';

const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/app');
const db = require('../src/config/postgres');
const jwt = require('jsonwebtoken');
const { expectDenied } = require('./utils/expectDenied');

describe('Null Tenant Scope, Multi-Tenant Isolation, and Suspended Tenant Tests', () => {
  let tenantAToken, tenantBToken;
  let tenantAId, tenantBId, suspendedTenantId;
  let suspendedUserToken;
  let productAId, customerAId, orderAId;
  let suspendedUsername;

  const stockRow = () => db.query(
    'SELECT qtyinstock, qtyavailable FROM tbl_stock WHERE productid = $1 AND tenant_id = $2',
    [productAId, tenantAId]
  );

  beforeAll(async () => {
    await db.query('DELETE FROM tenants WHERE subdomain LIKE $1', ['test-null-%']);

    const tA = await db.query('INSERT INTO tenants (name, subdomain) VALUES ($1, $2) RETURNING id', ['Tenant A', 'test-null-a-' + Date.now()]);
    tenantAId = tA.rows[0].id;

    const tB = await db.query('INSERT INTO tenants (name, subdomain) VALUES ($1, $2) RETURNING id', ['Tenant B', 'test-null-b-' + Date.now()]);
    tenantBId = tB.rows[0].id;

    const tSus = await db.query('INSERT INTO tenants (name, subdomain, status) VALUES ($1, $2, $3) RETURNING id', ['Suspended Tenant', 'test-null-sus-' + Date.now(), 'SUSPENDED']);
    suspendedTenantId = tSus.rows[0].id;

    const uA = await db.query('INSERT INTO tbl_users (username, email, password, role, tenant_id) VALUES ($1, $2, $3, $4, $5) RETURNING userid', ['user_a_' + Date.now(), 'usera_' + Date.now() + '@test.com', 'hashed', 'Admin', tenantAId]);
    tenantAToken = jwt.sign({ userId: uA.rows[0].userid, username: 'usera', role: 'Admin', tenantId: tenantAId, isSuperAdmin: false }, process.env.JWT_SECRET || 'secret');

    const uB = await db.query('INSERT INTO tbl_users (username, email, password, role, tenant_id) VALUES ($1, $2, $3, $4, $5) RETURNING userid', ['user_b_' + Date.now(), 'userb_' + Date.now() + '@test.com', 'hashed', 'Admin', tenantBId]);
    tenantBToken = jwt.sign({ userId: uB.rows[0].userid, username: 'userb', role: 'Admin', tenantId: tenantBId, isSuperAdmin: false }, process.env.JWT_SECRET || 'secret');

    suspendedUsername = 'user_sus_' + Date.now();
    const uSus = await db.query('INSERT INTO tbl_users (username, email, password, role, tenant_id) VALUES ($1, $2, $3, $4, $5) RETURNING userid', [suspendedUsername, 'usersus_' + Date.now() + '@test.com', 'hashed', 'Admin', suspendedTenantId]);
    suspendedUserToken = jwt.sign({ userId: uSus.rows[0].userid, username: 'usersus', role: 'Admin', tenantId: suspendedTenantId, isSuperAdmin: false }, process.env.JWT_SECRET || 'secret');

    const pA = await db.query('INSERT INTO tbl_products (name, price, tenant_id) VALUES ($1, $2, $3) RETURNING id', ['Product A', 100, tenantAId]);
    productAId = pA.rows[0].id;
    await db.query('INSERT INTO tbl_stock (productid, qtyinstock, qtyavailable, tenant_id) VALUES ($1, $2, $3, $4)', [productAId, 10, 10, tenantAId]);

    const cA = await db.query('INSERT INTO tbl_customers (cus_id, name, phone, tenant_id) VALUES ($1, $2, $3, $4) RETURNING id', ['CUS-A-' + Date.now(), 'Customer A', '010000000', tenantAId]);
    customerAId = cA.rows[0].id;

    const orderA = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tenantAToken}`)
      .send({
        customer_id: customerAId,
        items: [{ product_id: productAId, qty: 1 }],
        payment_method: 'Cash',
        idempotency_key: crypto.randomUUID()
      });
    if (orderA.status !== 201) {
      throw new Error(`Order A setup failed: ${orderA.status} ${JSON.stringify(orderA.body)}`);
    }
    orderAId = orderA.body.or_id || orderA.body.id;
  });

  afterAll(async () => {
    await db.query('DELETE FROM tenants WHERE id IN ($1, $2, $3)', [tenantAId, tenantBId, suspendedTenantId]);
  });

  it('Suspended tenant token gets 403 on every list route', async () => {
    for (const ep of ['orders', 'products', 'customers', 'suppliers', 'stock', 'categories', 'warranties', 'services']) {
      await expectDenied(app, {
        method: 'get',
        path: `/api/${ep}`,
        deniedToken: suspendedUserToken,
        allowedToken: tenantAToken,
        status: 403,
      });
    }
  });

  it('Admin B cannot receive stock into a Tenant A product', async () => {
    await expectDenied(app, {
      method: 'post',
      path: '/api/stock/receive',
      deniedToken: tenantBToken,
      allowedToken: tenantAToken,
      body: { product_id: productAId, qty: 2, reason: 'Purchase' },
      status: 404,
      readRow: stockRow,
    });
  });

  it('Admin B cannot adjust a Tenant A product stock', async () => {
    await expectDenied(app, {
      method: 'post',
      path: '/api/stock/adjust',
      deniedToken: tenantBToken,
      allowedToken: tenantAToken,
      body: { product_id: productAId, new_qty: 7, reason: 'Correction' },
      status: 404,
      readRow: stockRow,
    });
  });

  it("Admin B cannot create an order with Tenant A's customer id", async () => {
    await expectDenied(app, {
      method: 'post',
      path: '/api/orders',
      deniedToken: tenantBToken,
      allowedToken: tenantAToken,
      body: {
        customer_id: customerAId,
        items: [{ product_id: productAId, qty: 1 }],
        payment_method: 'Cash',
        idempotency_key: crypto.randomUUID()
      },
      status: 400,
      readRow: async () => (await db.query('SELECT or_id FROM tbl_orders WHERE tenant_id = $1', [tenantBId])).rows,
    });
  });

  it("Admin B cannot create an order with Tenant A's product id", async () => {
    await expectDenied(app, {
      method: 'post',
      path: '/api/orders',
      deniedToken: tenantBToken,
      allowedToken: tenantAToken,
      body: {
        items: [{ product_id: productAId, qty: 1 }],
        payment_method: 'Cash',
        idempotency_key: crypto.randomUUID()
      },
      status: 409,
      readRow: async () => (await db.query('SELECT or_id FROM tbl_orders WHERE tenant_id = $1', [tenantBId])).rows,
    });
  });

  it("Admin B cannot refund a Tenant A order", async () => {
    await expectDenied(app, {
      method: 'post',
      path: `/api/orders/${orderAId}/refund`,
      deniedToken: tenantBToken,
      allowedToken: tenantAToken,
      body: { reason: 'Hacked' },
      status: 404,
      readRow: async () => (await db.query(
        `SELECT (SELECT status FROM tbl_orders WHERE or_id = $1) AS order_status,
                (SELECT qtyavailable FROM tbl_stock WHERE productid = $2 AND tenant_id = $3) AS qty_available`,
        [orderAId, productAId, tenantAId]
      )).rows,
    });
  });

  it('Admin B cannot access Tenant A product by GET/PUT/DELETE', async () => {
    await expectDenied(app, {
      method: 'get',
      path: `/api/products/${productAId}`,
      deniedToken: tenantBToken,
      allowedToken: tenantAToken,
      status: 404,
      readRow: async () => (await db.query('SELECT name, price FROM tbl_products WHERE id = $1', [productAId])).rows,
    });

    await expectDenied(app, {
      method: 'put',
      path: `/api/products/${productAId}`,
      deniedToken: tenantBToken,
      allowedToken: tenantAToken,
      body: { name: 'Hacked' },
      status: 404,
      readRow: async () => (await db.query('SELECT name, price FROM tbl_products WHERE id = $1', [productAId])).rows,
    });

    await expectDenied(app, {
      method: 'delete',
      path: `/api/products/${productAId}`,
      deniedToken: tenantBToken,
      allowedToken: tenantAToken,
      status: 404,
      readRow: async () => (await db.query('SELECT status FROM tbl_products WHERE id = $1', [productAId])).rows,
    });
  });

  it('Spoofed X-Tenant-Id header does not expose Tenant A data', async () => {
    await expectDenied(app, {
      method: 'get',
      path: `/api/products/${productAId}`,
      deniedToken: tenantBToken,
      allowedToken: tenantAToken,
      headers: { 'x-tenant-id': String(tenantAId) },
      status: 404,
      readRow: async () => (await db.query('SELECT name, price FROM tbl_products WHERE id = $1', [productAId])).rows,
    });
  });

  it('Suspended tenant real login returns 403', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: suspendedUsername, password: 'password' });
    expect(res.status).toBe(403);
  });

  it('Suspended tenant existing token returns 403', async () => {
    await expectDenied(app, {
      method: 'get',
      path: '/api/products',
      deniedToken: suspendedUserToken,
      allowedToken: tenantAToken,
      status: 403,
    });
  });
});
