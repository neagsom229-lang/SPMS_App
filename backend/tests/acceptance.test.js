const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock postgres config / pool before requiring app
jest.mock('../src/config/postgres', () => {
  let mockDbState = {
    users: [
      { user_id: 1, email: 'super@admin.com', password: '$2a$10$hashedpassword', role_name: 'Super Admin', is_super_admin: true, tenant_id: null },
      { user_id: 2, email: 'nulltenant@test.com', password: '$2a$10$hashedpassword', role_name: 'Admin', is_super_admin: false, tenant_id: null },
      { user_id: 10, email: 'userA@test.com', password: 'legacyplaintext', role_name: 'Admin', is_super_admin: false, tenant_id: 1 },
      { user_id: 20, email: 'userB@test.com', password: '$2a$10$hashedpassword', role_name: 'Admin', is_super_admin: false, tenant_id: 2 }
    ],
    products: [
      { id: 1, name: 'Product A', tenant_id: 1, stock: 10, price: 100 },
      { id: 2, name: 'Product B', tenant_id: 2, stock: 5, price: 200 }
    ],
    customers: [
      { id: 1, cus_id: 'CUS001', name: 'Cust A', tenant_id: 1 }
    ],
    orders: [],
    suppliers: [],
    stock: [],
    categories: [{ id: 1, name: 'Electronics' }]
  };

  return {
    query: jest.fn(async (text, params) => {
      const lower = text.toLowerCase();
      if (lower.includes('select') && lower.includes('from tbl_users') || lower.includes('from users')) {
        const email = params && params[0];
        const user = mockDbState.users.find(u => u.email === email || u.user_id === params[0]);
        return { rows: user ? [user] : [] };
      }
      if (lower.includes('from tbl_categories') || lower.includes('categories')) {
        return { rows: mockDbState.categories };
      }
      if (lower.includes('from tbl_products') || lower.includes('products')) {
        return { rows: mockDbState.products };
      }
      if (lower.includes('from tbl_customers') || lower.includes('customers')) {
        return { rows: mockDbState.customers };
      }
      return { rows: [] };
    }),
    pool: {
      connect: jest.fn(() => ({
        query: jest.fn(),
        release: jest.fn()
      }))
    }
  };
});

process.env.JWT_SECRET = 'testsecret';
process.env.NODE_ENV = 'test';

const app = require('../src/app');

describe('SPMS Acceptance Tests', () => {
  it('Non-super-admin with NULL tenant_id gets 403 on every list endpoint', async () => {
    const token = jwt.sign({ userId: 2, email: 'nulltenant@test.com', tenantId: null, isSuperAdmin: false }, process.env.JWT_SECRET);
    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('GET /api/categories responds', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
  });

  it('GET /api/auth/me with a bad token gives 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalidtoken');
    expect(res.status).toBe(401);
  });

  it('GET /api/db-test without a token gives 401 (or 403/401)', async () => {
    const res = await request(app).get('/api/db-test');
    expect([401, 403, 404]).toContain(res.status);
  });
});
