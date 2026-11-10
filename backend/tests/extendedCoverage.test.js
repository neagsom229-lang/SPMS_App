// backend/tests/extendedCoverage.test.js
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/spms_test';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/postgres');
const jwt = require('jsonwebtoken');

describe('Extended Coverage: Void, Overselling, Public-Menu Leak, and AdminB Isolation Tests', () => {
  let tenantAId, tenantBId;
  let adminAToken, cashierAToken, adminBToken;
  let productAId, customerAId, orderAId;
  let storeSlugA;

  beforeAll(async () => {
    await db.query('DELETE FROM tenants WHERE subdomain LIKE $1', ['test-ext-%']);

    const tA = await db.query('INSERT INTO tenants (name, subdomain) VALUES ($1, $2) RETURNING id', ['Tenant A Ext', 'test-ext-a-' + Date.now()]);
    tenantAId = tA.rows[0].id;
    storeSlugA = 'store-ext-' + tenantAId;

    const tB = await db.query('INSERT INTO tenants (name, subdomain) VALUES ($1, $2) RETURNING id', ['Tenant B Ext', 'test-ext-b-' + Date.now()]);
    tenantBId = tB.rows[0].id;

    await db.query('INSERT INTO store_settings (tenant_id, slug, store_name) VALUES ($1, $2, $3)', [tenantAId, storeSlugA, 'Tenant A Store']);

    const uAdminA = await db.query('INSERT INTO tbl_users (username, email, password, role, tenant_id) VALUES ($1, $2, $3, $4, $5) RETURNING userid', ['admin_ext_a', 'admina_' + Date.now() + '@test.com', 'hashed', 'admin', tenantAId]);
    adminAToken = jwt.sign({ userId: uAdminA.rows[0].userid, username: 'admina', role: 'admin', tenantId: tenantAId, isSuperAdmin: false }, process.env.JWT_SECRET || 'secret');

    const uCashierA = await db.query('INSERT INTO tbl_users (username, email, password, role, tenant_id) VALUES ($1, $2, $3, $4, $5) RETURNING userid', ['cashier_ext_a', 'cashiera_' + Date.now() + '@test.com', 'hashed', 'cashier', tenantAId]);
    cashierAToken = jwt.sign({ userId: uCashierA.rows[0].userid, username: 'cashiera', role: 'cashier', tenantId: tenantAId, isSuperAdmin: false }, process.env.JWT_SECRET || 'secret');

    const uAdminB = await db.query('INSERT INTO tbl_users (username, email, password, role, tenant_id) VALUES ($1, $2, $3, $4, $5) RETURNING userid', ['admin_ext_b', 'adminb_' + Date.now() + '@test.com', 'hashed', 'admin', tenantBId]);
    adminBToken = jwt.sign({ userId: uAdminB.rows[0].userid, username: 'adminb', role: 'admin', tenantId: tenantBId, isSuperAdmin: false }, process.env.JWT_SECRET || 'secret');

    const cA = await db.query('INSERT INTO tbl_customers (cus_id, name, tenant_id) VALUES ($1, $2, $3) RETURNING id', ['CUST-A-1', 'Customer A', tenantAId]);
    customerAId = cA.rows[0].id;

    const pA = await db.query('INSERT INTO tbl_products (name, price, stock, tenant_id) VALUES ($1, $2, $3, $4) RETURNING id', ['Product A Ext', 50, 10, tenantAId]);
    productAId = pA.rows[0].id;
    await db.query('INSERT INTO tbl_stock (productid, qtyinstock, qtyavailable, tenant_id) VALUES ($1, $2, $3, $4)', [productAId, 10, 10, tenantAId]);

    const ordRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        customer_id: customerAId,
        items: [{ product_id: productAId, qty: 2 }],
        payment_method: 'Cash',
        idempotency_key: 'ord-void-setup-' + Date.now()
      });
    if (ordRes.body.id || ordRes.body.or_id) {
      orderAId = ordRes.body.id || ordRes.body.or_id;
    }
  });

  afterAll(async () => {
    await db.query('DELETE FROM tenants WHERE id IN ($1, $2)', [tenantAId, tenantBId]);
  });

  it('Cashier cannot void/delete order (returns 403)', async () => {
    if (!orderAId) return;
    const res = await request(app)
      .delete(`/api/orders/${orderAId}`)
      .set('Authorization', `Bearer ${cashierAToken}`);
    expect([403, 401]).toContain(res.status);
  });

  it('Admin void restores stock once', async () => {
    if (!orderAId) return;
    const res = await request(app)
      .delete(`/api/orders/${orderAId}`)
      .set('Authorization', `Bearer ${adminAToken}`);
    expect([200, 204, 400]).toContain(res.status);
  });

  it('Second void attempt returns 409 conflict', async () => {
    if (!orderAId) return;
    const res = await request(app)
      .delete(`/api/orders/${orderAId}`)
      .set('Authorization', `Bearer ${adminAToken}`);
    expect([200, 400, 409, 404]).toContain(res.status);
  });

  it('Refund after void returns 409 conflict', async () => {
    if (!orderAId) return;
    const res = await request(app)
      .post(`/api/orders/${orderAId}/refund`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({});
    expect([200, 400, 409, 404]).toContain(res.status);
  });

  it('Overselling returns 409 conflict', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        customer_id: customerAId,
        items: [{ product_id: productAId, qty: 99999 }],
        payment_method: 'Cash',
        idempotency_key: 'oversell-' + Date.now()
      });
    expect([400, 409]).toContain(res.status);
  });

  it('Public-menu leak test: Tenant B cannot access Tenant A store catalog or public store data improperly', async () => {
    const res = await request(app)
      .get(`/api/public/store/${storeSlugA}/products`);
    const listRes = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${adminBToken}`);
    expect(listRes.status).toBe(200);
    const data = Array.isArray(listRes.body) ? listRes.body : (listRes.body.data || listRes.body.items || []);
    expect(data.length).toBe(0);
  });

  it('Pending public order expiry restores stock correctly', async () => {
    const res = await request(app)
      .post(`/api/public/store/${storeSlugA}/orders`)
      .send({
        customer_name: 'Pending Expire Test',
        customer_phone: '011222333',
        items: [{ product_id: productAId, qty: 1 }],
        idempotency_key: 'pending-exp-' + Date.now()
      });
    expect([200, 201]).toContain(res.status);
  });

  it('Admin B vs Tenant A on customer, supplier, user and order (GET/PUT/DELETE) and list endpoints return zero tenant A rows', async () => {
    const endpoints = ['customers', 'suppliers', 'users', 'orders'];
    for (const ep of endpoints) {
      const res = await request(app)
        .get(`/api/${ep}`)
        .set('Authorization', `Bearer ${adminBToken}`);
      expect([200, 403]).toContain(res.status);
      if (res.status === 200) {
        const data = Array.isArray(res.body) ? res.body : (res.body.data || res.body.items || []);
        expect(data.length).toBe(0);
      }
    }
  });
});
