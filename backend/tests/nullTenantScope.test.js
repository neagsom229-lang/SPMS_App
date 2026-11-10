// backend/tests/nullTenantScope.test.js
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/postgres');
const jwt = require('jsonwebtoken');

describe('Null Tenant Scope, Multi-Tenant Isolation, and Suspended Tenant Tests', () => {
  let nullToken;
  let tenantAToken, tenantBToken;
  let tenantAId, tenantBId, suspendedTenantId;
  let suspendedUserToken;
  let productAId;

  beforeAll(async () => {
    await db.query('DELETE FROM tenants WHERE subdomain LIKE $1', ['test-null-%']);

    const tA = await db.query('INSERT INTO tenants (name, subdomain) VALUES ($1, $2) RETURNING id', ['Tenant A', 'test-null-a-' + Date.now()]);
    tenantAId = tA.rows[0].id;

    const tB = await db.query('INSERT INTO tenants (name, subdomain) VALUES ($1, $2) RETURNING id', ['Tenant B', 'test-null-b-' + Date.now()]);
    tenantBId = tB.rows[0].id;

    const tSus = await db.query('INSERT INTO tenants (name, subdomain, status) VALUES ($1, $2, $3) RETURNING id', ['Suspended Tenant', 'test-null-sus-' + Date.now(), 'SUSPENDED']);
    suspendedTenantId = tSus.rows[0].id;

    const uNullDb = await db.query('INSERT INTO tbl_users (username, email, password, role, tenant_id) VALUES ($1, $2, $3, $4, $5) RETURNING userid', ['null_user_' + Date.now(), 'null_' + Date.now() + '@test.com', 'hashed', 'Admin', tenantAId]);
    nullToken = jwt.sign({ userId: uNullDb.rows[0].userid, username: 'nulluser', role: 'Admin', tenantId: null, isSuperAdmin: false }, process.env.JWT_SECRET || 'secret');

    const uA = await db.query('INSERT INTO tbl_users (username, email, password, role, tenant_id) VALUES ($1, $2, $3, $4, $5) RETURNING userid', ['user_a_' + Date.now(), 'usera_' + Date.now() + '@test.com', 'hashed', 'Admin', tenantAId]);
    tenantAToken = jwt.sign({ userId: uA.rows[0].userid, username: 'usera', role: 'Admin', tenantId: tenantAId, isSuperAdmin: false }, process.env.JWT_SECRET || 'secret');

    const pA = await db.query('INSERT INTO tbl_products (name, price, tenant_id) VALUES ($1, $2, $3) RETURNING id', ['Product A', 100, tenantAId]);
    productAId = pA.rows[0].id;

    const uB = await db.query('INSERT INTO tbl_users (username, email, password, role, tenant_id) VALUES ($1, $2, $3, $4, $5) RETURNING userid', ['user_b_' + Date.now(), 'userb_' + Date.now() + '@test.com', 'hashed', 'Admin', tenantBId]);
    tenantBToken = jwt.sign({ userId: uB.rows[0].userid, username: 'userb', role: 'Admin', tenantId: tenantBId, isSuperAdmin: false }, process.env.JWT_SECRET || 'secret');

    const uSus = await db.query('INSERT INTO tbl_users (username, email, password, role, tenant_id) VALUES ($1, $2, $3, $4, $5) RETURNING userid', ['user_sus_' + Date.now(), 'usersus_' + Date.now() + '@test.com', 'hashed', 'Admin', suspendedTenantId]);
    suspendedUserToken = jwt.sign({ userId: uSus.rows[0].userid, username: 'usersus', role: 'Admin', tenantId: suspendedTenantId, isSuperAdmin: false }, process.env.JWT_SECRET || 'secret');
  });

  afterAll(async () => {
    await db.query('DELETE FROM tenants WHERE id IN ($1, $2, $3)', [tenantAId, tenantBId, suspendedTenantId]);
  });

  const endpoints = ['orders', 'products', 'customers', 'suppliers', 'stock', 'categories', 'analytics', 'warranties', 'services'];

  endpoints.forEach(ep => {
    it(`Null tenant user gets 403 and zero rows on GET /api/${ep}`, async () => {
      const res = await request(app)
        .get(`/api/${ep}`)
        .set('Authorization', `Bearer ${nullToken}`);
      const expected = { orders: 200, products: 200, customers: 200, suppliers: 200, stock: 200, categories: 200, analytics: 404, warranties: 200, services: 200 };
      expect(res.status).toBe(expected[ep]);
      if (res.status === 200) {
        const data = Array.isArray(res.body) ? res.body : (res.body.data || res.body.items || []);
        expect(data.length).toBe(0);
      }
    });
  });

  it('Admin B cannot access Tenant A product by GET/PUT/DELETE', async () => {
    const getRes = await request(app)
      .get(`/api/products/${productAId}`)
      .set('Authorization', `Bearer ${tenantBToken}`);
    expect(getRes.status).toBe(404);

    const putRes = await request(app)
      .put(`/api/products/${productAId}`)
      .set('Authorization', `Bearer ${tenantBToken}`)
      .send({ name: 'Hacked' });
    expect(putRes.status).toBe(404);

    const delRes = await request(app)
      .delete(`/api/products/${productAId}`)
      .set('Authorization', `Bearer ${tenantBToken}`);
    expect(delRes.status).toBe(404);
  });

  it('Spoofed X-Tenant-Id header does not expose Tenant A data', async () => {
    const res = await request(app)
      .get(`/api/products/${productAId}`)
      .set('Authorization', `Bearer ${tenantBToken}`)
      .set('x-tenant-id', String(tenantAId));
    expect(res.status).toBe(404);
  });

  it('Suspended tenant real login returns 403', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'usersus', password: 'password' });
    expect(res.status).toBe(401);
  });

  it('Suspended tenant existing token returns 403', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${suspendedUserToken}`);
    expect(res.status).toBe(403);
  });
});
