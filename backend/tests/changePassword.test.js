// backend/tests/changePassword.test.js
//
// 11c: POST /auth/change-password must not accept a change that omits the old
// password (the bcrypt branch previously ran the verification only when
// oldPassword was present, so omitting it skipped the check entirely), and
// PUT /users/:id/password must carry the same Admin gate as the other
// user-management routes (GET /, POST /, PUT /:id), so a cashier cannot take
// over another account in the tenant.
const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/app');
const db = require('../src/config/postgres');
const { expectDenied } = require('./utils/expectDenied');

const runId = crypto.randomBytes(4).toString('hex');
const prefix = `cpw-${runId}-`;

describe('Change password endpoints', () => {
  let adminToken;
  let u1Token, u1Id;
  let u2Token, u2Id;

  const login = async (username) => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username, password: 'Qa!123456' });
    expect(res.status).toBe(200);
    return res.body.token;
  };

  const createUser = async (label) => {
    const username = prefix + label;
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({
        username,
        password: 'Qa!123456',
        role: 'cashier',
        fullname: 'CPW ' + label,
        email: username + '@test.com',
      });
    expect(res.status).toBe(201);
    return { id: res.body.user.userid, token: await login(username) };
  };

  beforeAll(async () => {
    const subdomain = prefix + 't';
    await request(app)
      .post('/api/auth/register-client')
      .send({
        businessName: `CPW ${runId}`,
        email: subdomain + '@test.com',
        password: 'Qa!123456',
        subdomain,
      });
    adminToken = await login(subdomain + '_admin');

    const u1 = await createUser('u1');
    u1Token = u1.token;
    u1Id = u1.id;

    const u2 = await createUser('u2');
    u2Token = u2.token;
    u2Id = u2.id;
  });

  test('POST /auth/change-password without an old password is rejected and the stored password is unchanged', async () => {
    await expectDenied(app, {
      method: 'post',
      path: '/api/auth/change-password',
      deniedToken: u1Token,
      allowedToken: u1Token,
      body: { newPassword: 'BrandNewPass1!' },
      status: 400,
      readRow: async () =>
        (await db.query('SELECT password FROM tbl_users WHERE userid = $1', [u1Id])).rows,
      allowedBody: { oldPassword: 'Qa!123456', newPassword: 'BrandNewPass1!' },
    });
  });

  test('POST /auth/change-password with a wrong old password is rejected and the stored password is unchanged', async () => {
    await expectDenied(app, {
      method: 'post',
      path: '/api/auth/change-password',
      deniedToken: u2Token,
      allowedToken: u2Token,
      body: { oldPassword: 'definitely-not-the-password', newPassword: 'BrandNewPass2!' },
      status: 401,
      readRow: async () =>
        (await db.query('SELECT password FROM tbl_users WHERE userid = $1', [u2Id])).rows,
      allowedBody: { oldPassword: 'Qa!123456', newPassword: 'BrandNewPass2!' },
    });
  });

  test('a cashier cannot reset another user password through PUT /users/:id/password', async () => {
    await expectDenied(app, {
      method: 'put',
      path: `/api/users/${u2Id}/password`,
      deniedToken: u1Token,
      allowedToken: adminToken,
      body: { newPassword: 'ResetByAdmin1!' },
      status: 403,
      readRow: async () =>
        (await db.query('SELECT password FROM tbl_users WHERE userid = $1', [u2Id])).rows,
    });
  });
});
