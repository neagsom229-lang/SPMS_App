// backend/tests/rolePolicyCaseVariant.test.js
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/postgres');
const jwt = require('jsonwebtoken');
const { expectDenied } = require('./utils/expectDenied');

describe('Role Policy Case-Variant and Route Walk Tests', () => {
  let cashierToken, adminToken;
  let tenantId, prodId, customerId;

  beforeAll(async () => {
    await db.query('DELETE FROM tenants WHERE subdomain LIKE $1', ['test-role-%']);
    const tRes = await db.query(
      'INSERT INTO tenants (name, subdomain) VALUES ($1, $2) RETURNING id',
      ['Test Role Tenant', 'test-role-' + Date.now()]
    );
    tenantId = tRes.rows[0].id;

    const adminRes = await db.query(
      'INSERT INTO tbl_users (username, email, password, role, tenant_id) VALUES ($1, $2, $3, $4, $5) RETURNING userid',
      ['admin_role_' + Date.now(), 'admin_role_' + Date.now() + '@test.com', 'hashed', 'Admin', tenantId]
    );
    const adminId = adminRes.rows[0].userid;
    adminToken = jwt.sign(
      { userId: adminId, username: 'admin', role: 'Admin', tenantId, isSuperAdmin: false },
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
    await db.query(
      'INSERT INTO tbl_stock (productid, qtyinstock, qtyavailable, tenant_id) VALUES ($1, $2, $3, $4)',
      [prodId, 10, 10, tenantId]
    );

    const cRes = await db.query(
      'INSERT INTO tbl_customers (cus_id, name, phone, tenant_id) VALUES ($1, $2, $3, $4) RETURNING id',
      ['CUS-' + Date.now(), 'Cust Role', '012345678', tenantId]
    );
    customerId = cRes.rows[0].id;

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

  const createOrder = async () => {
    const res = await db.query(
      `INSERT INTO tbl_orders (tenant_id, customer_id, total, payment_method, status, order_no)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING or_id`,
      [tenantId, customerId, 20, 'Cash', 'Pending', 'ORD-' + Date.now() + '-' + Math.random().toString(16).slice(2)]
    );
    return res.rows[0].or_id;
  };

  const orderRow = async id => (await db.query(
    'SELECT status, voided_at, void_reason, updated_at FROM tbl_orders WHERE or_id = $1',
    [id]
  )).rows;

  it('Cashier case-variant POST /api/Orders/:id/Refund returns 403', async () => {
    const id = await createOrder();
    await expectDenied(app, {
      method: 'post',
      path: `/api/Orders/${id}/Refund`,
      deniedToken: cashierToken,
      allowedToken: adminToken,
      body: { reason: 'test' },
      status: 403,
      readRow: () => orderRow(id),
    });
  });

  it('Cashier case-variant POST /api/Orders/:id/Cancel returns 403', async () => {
    const id = await createOrder();
    await expectDenied(app, {
      method: 'post',
      path: `/api/Orders/${id}/Cancel`,
      deniedToken: cashierToken,
      allowedToken: adminToken,
      body: { reason: 'test' },
      status: 403,
      readRow: () => orderRow(id),
    });
  });

  it('Cashier case-variant PATCH /api/Orders/:id/Status returns 403', async () => {
    const id = await createOrder();
    await expectDenied(app, {
      method: 'patch',
      path: `/api/Orders/${id}/Status`,
      deniedToken: cashierToken,
      allowedToken: adminToken,
      body: { status: 'Cancelled' },
      status: 403,
      readRow: () => orderRow(id),
    });
  });

  it('Cashier case-variant DELETE /api/Orders/:id returns 403', async () => {
    const id = await createOrder();
    await expectDenied(app, {
      method: 'delete',
      path: `/api/Orders/${id}`,
      deniedToken: cashierToken,
      allowedToken: adminToken,
      body: { reason: 'test' },
      status: 403,
      readRow: () => orderRow(id),
    });
  });

  it('Cashier case-variant GET /api/USERS returns 403', async () => {
    await expectDenied(app, {
      method: 'get',
      path: '/api/USERS',
      deniedToken: cashierToken,
      allowedToken: adminToken,
      status: 403,
    });
  });

  it('Cashier case-variant GET /api/Users/ returns 403', async () => {
    await expectDenied(app, {
      method: 'get',
      path: '/api/Users/',
      deniedToken: cashierToken,
      allowedToken: adminToken,
      status: 403,
    });
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
    expect(res.status).toBe(404);
  });
});
