// backend/tests/rolePolicyCaseVariant.test.js
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/spms_test';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/postgres');
const jwt = require('jsonwebtoken');

describe('Role Policy Case-Variant and Route Walk Tests', () => {
  let cashierToken, adminToken;
  let tenantId, orderId, prodId;

  beforeAll(async () => {
    await db.query('DELETE FROM tenants WHERE subdomain LIKE $1', ['test-role-%']);
    const tRes = await db.query(
      'INSERT INTO tenants (name, subdomain) VALUES ($1, $2) RETURNING id',
      ['Test Role Tenant', 'test-role-' + Date.now()]
    );
    tenantId = tRes.rows[0].id;

    const adminRes = await db.query(
      'INSERT INTO tbl_users (username, email, password, role, tenant_id) VALUES ($1, $2, $3, $4, $5) RETURNING userid',
      ['admin_role_' + Date.now(), 'admin_role_' + Date.now() + '@test.com', 'hashed', 'admin', tenantId]
    );
    const adminId = adminRes.rows[0].userid;
    adminToken = jwt.sign(
      { userId: adminId, username: 'admin', role: 'admin', tenantId, isSuperAdmin: false },
      process.env.JWT_SECRET || 'supersecretjwtkeyforunitandintegrationtesting123456789'
    );

    const catRes = await db.query(
      'INSERT INTO tbl_categories (name, tenant_id) VALUES ($1, $2) RETURNING id',
      ['Cat Role', tenantId]
    );
    const catId = catRes.rows[0].id;

    const pRes = await db.query(
      'INSERT INTO tbl_products (name, barcode, cost, price, category_id, tenant_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      ['Prod Role', 'BAR-' + Date.now(), 5, 20, catId, tenantId]
    );
    prodId = pRes.rows[0].id;

    const cRes = await db.query(
      'INSERT INTO tbl_customers (cus_id, name, phone, tenant_id) VALUES ($1, $2, $3, $4) RETURNING id',
      ['CUS-' + Date.now(), 'Cust Role', '012345678', tenantId]
    );
    const customerId = cRes.rows[0].id;

    const oRes = await db.query(
      'INSERT INTO tbl_orders (tenant_id, customer_id, total, payment_method, status, order_no) VALUES ($1, $2, $3, $4, $5, $6) RETURNING or_id',
      [tenantId, customerId, 20, 'Cash', 'Pending', 'ORD-' + Date.now()]
    );
    orderId = oRes.rows[0].or_id;

    const uRes = await db.query(
      'INSERT INTO tbl_users (username, email, password, role, tenant_id) VALUES ($1, $2, $3, $4, $5) RETURNING userid',
      ['cashier_role_' + Date.now(), 'cashier_role_' + Date.now() + '@test.com', 'hashed', 'cashier', tenantId] 
    );
    const userId = uRes.rows[0].userid;

    cashierToken = jwt.sign(
      { userId, username: 'cashier', role: 'cashier', tenantId, isSuperAdmin: false },
      process.env.JWT_SECRET || 'supersecretjwtkeyforunitandintegrationtesting123456789'
    );
  });

  afterAll(async () => {
    await db.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
  });

  it('Cashier case-variant POST /api/Orders/:id/Refund returns 403', async () => {
    const res = await request(app)
      .post(`/api/Orders/${orderId}/Refund`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ reason: 'test' });
    expect(res.status).toBe(403);
  });

  it('Cashier case-variant POST /api/Orders/:id/Cancel returns 403', async () => {
    const res = await request(app)
      .post(`/api/Orders/${orderId}/Cancel`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ reason: 'test' });
    expect(res.status).toBe(403);
  });

  it('Cashier case-variant PATCH /api/Orders/:id/Status returns 403', async () => {
    const res = await request(app)
      .patch(`/api/Orders/${orderId}/Status`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ status: 'Cancelled' });
    expect(res.status).toBe(403);
  });

  it('Cashier case-variant DELETE /api/Orders/:id returns 403', async () => {
    const res = await request(app)
      .delete(`/api/Orders/${orderId}`)
      .set('Authorization', `Bearer ${cashierToken}`);
    expect(res.status).toBe(403);
  });

  it('Cashier case-variant GET /api/USERS returns 403', async () => {
    const res = await request(app)
      .get('/api/USERS')
      .set('Authorization', `Bearer ${cashierToken}`);
    expect(res.status).toBe(403);
  });

  it('Cashier case-variant GET /api/Users/ returns 403', async () => {
    const res = await request(app)
      .get('/api/Users/')
      .set('Authorization', `Bearer ${cashierToken}`);
    expect(res.status).toBe(403);
  });

  it('Cashier case-variant GET /api/REPORTS returns 403', async () => {
    const res = await request(app)
      .get('/api/REPORTS')
      .set('Authorization', `Bearer ${cashierToken}`);
    expect(res.status).toBe(403);
  });

  it('Cashier case-variant GET /api/%75sers returns 403 or 404', async () => {
    const res = await request(app)
      .get('/api/%75sers')
      .set('Authorization', `Bearer ${cashierToken}`);
    expect([403, 404]).toContain(res.status);
  });
});
