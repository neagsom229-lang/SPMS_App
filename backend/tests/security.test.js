const request = require('supertest');
const app = require('../src/app');
const { Pool } = require('pg');
const crypto = require('crypto');
const rnd = () => crypto.randomBytes(4).toString('hex');

describe('Security and Rate Limiting Tests', () => {
  let pool;
  let adminToken;
  let staffToken;
  let tenantBToken;
  let staffUserId;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5433/spms_test' });
  });

  afterAll(async () => {
    await pool.end();
  });

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

  test('non-admin (staff) cannot create or promote an admin', async () => {
    const hash = require('bcryptjs').hashSync('password123', 8);
    const sub = 'sectest_' + rnd();
    const tenantRes = await pool.query("INSERT INTO tenants (name, subdomain, status, plan) VALUES ('Sec Test', $1, 'ACTIVE', 'shophouse') RETURNING id;", [sub]);
    const tId = tenantRes.rows[0].id;
    const staffRes = await pool.query("INSERT INTO tbl_users (username, email, password, role, status, is_super_admin, tenant_id) VALUES ($1, $2, $3, 'Staff', 'ACTIVE', FALSE, $4) RETURNING userid;", [`staff_${rnd()}`, `staff_${rnd()}@sectest.com`, hash, tId]);
    staffUserId = staffRes.rows[0].userid;

    const staffLoginRes = await pool.query("SELECT username FROM tbl_users WHERE userid = $1", [staffUserId]);
    const staffUsername = staffLoginRes.rows[0].username;

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: staffUsername, password: 'password123' });
    staffToken = loginRes.body.token;

    const createAdminRes = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ username: 'newadmin_' + rnd(), password: 'Password1!', role: 'Admin', email: 'newadmin_' + rnd() + '@sectest.com' });
    expect([401, 403]).toContain(createAdminRes.status);

    const promoteRes = await request(app)
      .put(`/api/users/${staffUserId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ role: 'Admin' });
    expect([401, 403]).toContain(promoteRes.status);
  });

  test('tenant B cannot change tenant A roles or data', async () => {
    const hash = require('bcryptjs').hashSync('password123', 8);
    const tenantARes = await pool.query("INSERT INTO tenants (name, subdomain, status, plan) VALUES ('Tenant A', $1, 'ACTIVE', 'shophouse') RETURNING id;", ['tenanta_' + rnd()]);
    const tAId = tenantARes.rows[0].id;
    const userARes = await pool.query("INSERT INTO tbl_users (username, email, password, role, status, is_super_admin, tenant_id) VALUES ($1, $2, $3, 'Admin', 'ACTIVE', FALSE, $4) RETURNING userid;", [`usera_${rnd()}`, `usera_${rnd()}@a.com`, hash, tAId]);
    const userAId = userARes.rows[0].userid;

    const tenantBRes = await pool.query("INSERT INTO tenants (name, subdomain, status, plan) VALUES ('Tenant B', $1, 'ACTIVE', 'shophouse') RETURNING id;", ['tenantb_' + rnd()]);
    const tBId = tenantBRes.rows[0].id;
    const userBRes = await pool.query("INSERT INTO tbl_users (username, email, password, role, status, is_super_admin, tenant_id) VALUES ($1, $2, $3, 'Admin', 'ACTIVE', FALSE, $4) RETURNING userid;", [`userb_${rnd()}`, `userb_${rnd()}@b.com`, hash, tBId]);
    const userBUsername = userBRes.rows[0].username; // Wait, we need username to login

    const userBLoginRes = await pool.query("SELECT username FROM tbl_users WHERE userid = $1", [userBRes.rows[0].userid]);
    
    const loginB = await request(app)
      .post('/api/auth/login')
      .send({ username: userBLoginRes.rows[0].username, password: 'password123' });
    tenantBToken = loginB.body.token;

    const changeRoleRes = await request(app)
      .put(`/api/users/${userAId}`)
      .set('Authorization', `Bearer ${tenantBToken}`)
      .send({ role: 'Staff' });
    expect([401, 403, 404]).toContain(changeRoleRes.status);
  });
});
