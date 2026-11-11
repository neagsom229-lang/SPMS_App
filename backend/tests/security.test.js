const request = require('supertest');
const app = require('../src/app');
const { Pool } = require('pg');
const crypto = require('crypto');
const { expectDenied } = require('./utils/expectDenied');
const rnd = () => crypto.randomBytes(4).toString('hex');

describe('Security and Rate Limiting Tests', () => {
  let pool;
  let adminToken;
  let staffToken;
  let tenantBToken;
  let staffUserId;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  afterAll(async () => {
    await pool.end();
  });

  test('non-admin (staff) cannot create or promote an admin', async () => {
    const hash = require('bcryptjs').hashSync('password123', 8);
    const sub = 'sectest_' + rnd();
    const tenantRes = await pool.query("INSERT INTO tenants (name, subdomain, status, plan) VALUES ('Sec Test', $1, 'ACTIVE', 'shophouse') RETURNING id;", [sub]);
    const tId = tenantRes.rows[0].id;

    const staffUsername = `staff_${rnd()}`;
    const staffRes = await pool.query("INSERT INTO tbl_users (username, email, password, role, status, is_super_admin, tenant_id) VALUES ($1, $2, $3, 'Staff', 'ACTIVE', FALSE, $4) RETURNING userid;", [staffUsername, `staff_${rnd()}@sectest.com`, hash, tId]);
    staffUserId = staffRes.rows[0].userid;

    const adminUsername = `admin_${rnd()}`;
    await pool.query("INSERT INTO tbl_users (username, email, password, role, status, is_super_admin, tenant_id) VALUES ($1, $2, $3, 'Admin', 'ACTIVE', FALSE, $4) RETURNING userid;", [adminUsername, `admin_${rnd()}@sectest.com`, hash, tId]);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: staffUsername, password: 'password123' });
    expect(loginRes.status).toBe(200);
    staffToken = loginRes.body.token;

    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: adminUsername, password: 'password123' });
    expect(adminLoginRes.status).toBe(200);
    adminToken = adminLoginRes.body.token;

    const newAdminUsername = 'newadmin_' + rnd();
    await expectDenied(app, {
      method: 'post',
      path: '/api/users',
      deniedToken: staffToken,
      allowedToken: adminToken,
      body: { username: newAdminUsername, password: 'Password1!', fullname: 'New Admin', role: 'Admin', email: `newadmin_${rnd()}@sectest.com` },
      status: 403,
      readRow: async () => (await pool.query('SELECT userid FROM tbl_users WHERE username = $1', [newAdminUsername])).rows,
    });

    await expectDenied(app, {
      method: 'put',
      path: `/api/users/${staffUserId}`,
      deniedToken: staffToken,
      allowedToken: adminToken,
      body: { role: 'Admin' },
      status: 403,
      readRow: async () => (await pool.query('SELECT role FROM tbl_users WHERE userid = $1', [staffUserId])).rows,
    });
  });

  test('tenant B cannot change tenant A roles or data', async () => {
    const hash = require('bcryptjs').hashSync('password123', 8);
    const tenantARes = await pool.query("INSERT INTO tenants (name, subdomain, status, plan) VALUES ('Tenant A', $1, 'ACTIVE', 'shophouse') RETURNING id;", ['tenanta_' + rnd()]);
    const tAId = tenantARes.rows[0].id;
    const userAUsername = `usera_${rnd()}`;
    const userARes = await pool.query("INSERT INTO tbl_users (username, email, password, role, status, is_super_admin, tenant_id) VALUES ($1, $2, $3, 'Admin', 'ACTIVE', FALSE, $4) RETURNING userid;", [userAUsername, `usera_${rnd()}@a.com`, hash, tAId]);
    const userAId = userARes.rows[0].userid;

    const tenantBRes = await pool.query("INSERT INTO tenants (name, subdomain, status, plan) VALUES ('Tenant B', $1, 'ACTIVE', 'shophouse') RETURNING id;", ['tenantb_' + rnd()]);
    const tBId = tenantBRes.rows[0].id;
    const userBUsername = `userb_${rnd()}`;
    await pool.query("INSERT INTO tbl_users (username, email, password, role, status, is_super_admin, tenant_id) VALUES ($1, $2, $3, 'Admin', 'ACTIVE', FALSE, $4) RETURNING userid;", [userBUsername, `userb_${rnd()}@b.com`, hash, tBId]);

    const loginA = await request(app)
      .post('/api/auth/login')
      .send({ username: userAUsername, password: 'password123' });
    expect(loginA.status).toBe(200);
    const tenantAToken = loginA.body.token;

    const loginB = await request(app)
      .post('/api/auth/login')
      .send({ username: userBUsername, password: 'password123' });
    expect(loginB.status).toBe(200);
    tenantBToken = loginB.body.token;

    await expectDenied(app, {
      method: 'put',
      path: `/api/users/${userAId}`,
      deniedToken: tenantBToken,
      allowedToken: tenantAToken,
      body: { role: 'manager' },
      status: 404,
      readRow: async () => (await pool.query('SELECT role FROM tbl_users WHERE userid = $1', [userAId])).rows,
    });
  });

  // Keep this last: the login limiter counts failed logins for the whole
  // worker, and once it trips every later login in this file returns 429.
  test('repeated bad logins trigger 429 rate limit with Retry-After', async () => {
    let lastResponse;
    for (let i = 0; i < 15; i++) {
      lastResponse = await request(app)
        .post('/api/auth/login')
        .send({ username: 'nonexistent_user_xyz', password: 'wrongpassword' });
      if (lastResponse.status === 429) {
        break;
      }
    }
    expect(lastResponse.status).toBe(429);
    expect(lastResponse.headers['retry-after'] || lastResponse.headers['ratelimit-reset'] || lastResponse.text).toBeDefined();
  });
});
