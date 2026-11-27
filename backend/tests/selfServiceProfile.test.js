// backend/tests/selfServiceProfile.test.js
//
// 11d: the Settings profile form now saves through PUT /auth/profile, so that
// route must be pinned: it persists fullname and email to tbl_users for the
// logged-in user, and it is self-service (a cashier gets 2xx and a real row
// change - no Admin gate, unlike PUT /users/:id).
const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/app');
const db = require('../src/config/postgres');

const runId = crypto.randomBytes(4).toString('hex');
const prefix = `ssp-${runId}-`;

describe('Self-service profile update (PUT /auth/profile)', () => {
  let adminToken;
  let cashierToken, cashierId;

  const login = async (username) => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username, password: 'Qa!123456' });
    expect(res.status).toBe(200);
    return res.body.token;
  };

  beforeAll(async () => {
    const subdomain = prefix + 't';
    await request(app)
      .post('/api/auth/register-client')
      .send({
        businessName: `SSP ${runId}`,
        email: subdomain + '@test.com',
        password: 'Qa!123456',
        subdomain,
      });
    adminToken = await login(subdomain + '_admin');

    const cashier = await request(app)
      .post('/api/users')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({
        username: prefix + 'cashier',
        password: 'Qa!123456',
        role: 'cashier',
        fullname: 'SSP Cashier',
        email: prefix + 'cashier@test.com',
      });
    expect(cashier.status).toBe(201);
    cashierId = cashier.body.user.userid;
    cashierToken = await login(prefix + 'cashier');
  });

  test('PUT /auth/profile persists fullname and email to tbl_users', async () => {
    const res = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ fullname: `SSP Saved Name ${runId}`, email: `ssp-saved-${runId}@test.com` });
    expect(res.status).toBe(200);
    expect(res.body.user.fullname).toBe(`SSP Saved Name ${runId}`);
    expect(res.body.user.email).toBe(`ssp-saved-${runId}@test.com`);

    // The change must exist in the database, not only in the response.
    const row = await db.query(
      'SELECT fullname, email FROM tbl_users WHERE userid = $1',
      [res.body.user.userid]
    );
    expect(row.rows[0]).toEqual({
      fullname: `SSP Saved Name ${runId}`,
      email: `ssp-saved-${runId}@test.com`,
    });
  });

  test('a cashier can update their own profile through PUT /auth/profile', async () => {
    const res = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', 'Bearer ' + cashierToken)
      .send({ fullname: `SSP Cashier Renamed ${runId}`, email: `ssp-cashier-${runId}@test.com` });
    expect(res.status).toBe(200);
    expect(res.body.user.userid).toBe(cashierId);

    const row = await db.query(
      'SELECT fullname, email FROM tbl_users WHERE userid = $1',
      [cashierId]
    );
    expect(row.rows[0]).toEqual({
      fullname: `SSP Cashier Renamed ${runId}`,
      email: `ssp-cashier-${runId}@test.com`,
    });
  });
});
