const request = require('supertest');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const app = require('../src/app');
const { expectDenied } = require('./utils/expectDenied');

const runId = crypto.randomBytes(4).toString('hex');
const prefix = `payt-${runId}-`;

describe('Bakong payment routes', () => {
  let pool;
  let tenantPlanId;
  let tenantOtherId;
  let adminToken;
  let staffToken;
  let otherToken;
  let superToken;
  let superId;

  async function createTenant(plan) {
    const res = await pool.query(
      `INSERT INTO tenants (name, subdomain, status, plan, plan_expires_at)
       VALUES ($1, $2, 'ACTIVE', $3, '2030-01-01T00:00:00Z') RETURNING id`,
      [`Pay ${plan} ${runId}`, `${prefix}${plan}`, plan]
    );
    return res.rows[0].id;
  }

  async function createUser(username, tenantId, role = 'Admin', isSuper = false) {
    const hash = bcrypt.hashSync('password123', 8);
    const res = await pool.query(
      `INSERT INTO tbl_users (username, email, password, role, status, is_super_admin, tenant_id)
       VALUES ($1, $2, $3, $4, 'ACTIVE', $5, $6) RETURNING userid`,
      [username, `${username}@pay.test`, hash, role, isSuper, tenantId]
    );
    return res.rows[0].userid;
  }

  async function login(username) {
    const res = await request(app).post('/api/auth/login').send({ username, password: 'password123' });
    expect(res.status).toBe(200);
    return res.body.token;
  }

  async function createSession(tenantId, md5, extra = {}) {
    const res = await pool.query(
      `INSERT INTO khqr_sessions (tenant_id, user_id, plan, period_months, amount, expected_amount, currency, md5, status, expires_at)
       VALUES ($1, $2, $3, 1, $4, $4, 'USD', $5, 'PENDING', NOW() + interval '15 minutes') RETURNING id`,
      [tenantId, extra.userId || null, extra.plan || 'shophouse', extra.amount || 19, md5]
    );
    return res.rows[0].id;
  }

  const md5 = () => crypto.randomBytes(16).toString('hex');

  const snapshot = async (sessionId, tenantId) => ({
    session: (await pool.query(
      `SELECT status, verified_by, paid_at, bakong_hash, raw_response FROM khqr_sessions WHERE id = $1`,
      [sessionId]
    )).rows,
    tenant: (await pool.query(
      `SELECT plan, plan_expires_at FROM tenants WHERE id = $1`,
      [tenantId]
    )).rows,
  });

  const markPaid = (sessionId, token, reason = 'manual test') =>
    request(app)
      .post(`/api/payment/admin/sessions/${sessionId}/mark-paid`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason });

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    tenantPlanId = await createTenant('shophouse');
    tenantOtherId = await createTenant('chain');
    await createUser(`${prefix}admin`, tenantPlanId);
    await createUser(`${prefix}staff`, tenantPlanId, 'Staff');
    await createUser(`${prefix}other`, tenantOtherId);
    superId = await createUser(`${prefix}super`, null, 'Admin', true);

    adminToken = await login(`${prefix}admin`);
    staffToken = await login(`${prefix}staff`);
    otherToken = await login(`${prefix}other`);
    superToken = await login(`${prefix}super`);
  });

  beforeEach(async () => {
    await pool.query(
      `UPDATE tenants SET plan = 'shophouse', plan_expires_at = '2030-01-01T00:00:00Z' WHERE id = $1`,
      [tenantPlanId]
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM tenants WHERE subdomain LIKE $1`, [`${prefix}%`]);
    await pool.end();
  });

  test('subscription returns the tenant plan and create-qr persists a pending session at the plan price', async () => {
    const sub = await request(app).get('/api/payment/subscription').set('Authorization', `Bearer ${adminToken}`);
    expect(sub.status).toBe(200);
    expect(sub.body.plan).toBe('shophouse');

    const chainSub = await request(app).get('/api/payment/subscription').set('Authorization', `Bearer ${otherToken}`);
    expect(chainSub.status).toBe(200);
    expect(chainSub.body.plan).toBe('chain');

    const qr = await request(app)
      .post('/api/payment/bakong/create-qr')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ plan: 'shophouse', period_months: 1, currency: 'USD' });
    expect(qr.status).toBe(200);
    expect(Number(qr.body.amount)).toBe(19);

    const qrChain = await request(app)
      .post('/api/payment/bakong/create-qr')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ plan: 'chain', period_months: 1, currency: 'USD' });
    expect(qrChain.status).toBe(200);
    expect(Number(qrChain.body.amount)).toBe(49);

    const row = await pool.query(`SELECT status, expected_amount, plan, tenant_id FROM khqr_sessions WHERE md5 = $1`, [qr.body.md5]);
    expect(row.rows[0].status).toBe('PENDING');
    expect(Number(row.rows[0].expected_amount)).toBe(19);
    expect(row.rows[0].plan).toBe('shophouse');
    expect(row.rows[0].tenant_id).toBe(tenantPlanId);
  });

  test('removed KHQR check endpoint is gone (404)', async () => {
    const res = await request(app)
      .get(`/api/payment/bakong/check/${md5()}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  test('pricing is server-side: client amount ignored, invalid plan/period/currency and period >= 120 rejected', async () => {
    const legit = await request(app)
      .post('/api/payment/bakong/create-qr')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ plan: 'shophouse', period_months: 1, currency: 'USD', amount: 1 });
    expect(legit.status).toBe(200);
    expect(Number(legit.body.amount)).toBe(19);

    const stored = await pool.query(`SELECT expected_amount FROM khqr_sessions WHERE md5 = $1`, [legit.body.md5]);
    expect(Number(stored.rows[0].expected_amount)).toBe(19);

    const unknownPlan = await request(app)
      .post('/api/payment/bakong/create-qr')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ plan: 'enterprise', period_months: 1, currency: 'USD' });
    expect(unknownPlan.status).toBe(400);

    const unknownPeriod = await request(app)
      .post('/api/payment/bakong/create-qr')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ plan: 'shophouse', period_months: 3, currency: 'USD' });
    expect(unknownPeriod.status).toBe(400);

    const unknownCurrency = await request(app)
      .post('/api/payment/bakong/create-qr')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ plan: 'shophouse', period_months: 1, currency: 'EUR' });
    expect(unknownCurrency.status).toBe(400);

    const periodTooLong = await request(app)
      .post('/api/payment/bakong/create-qr')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ plan: 'shophouse', period_months: 120, currency: 'USD' });
    expect(periodTooLong.status).toBe(400);
  });

  test('a zero or negative period is rejected', async () => {
    for (const period_months of [0, -1]) {
      const res = await request(app)
        .post('/api/payment/bakong/create-qr')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ plan: 'shophouse', period_months, currency: 'USD' });
      expect(res.status).toBe(400);
    }
  });

  test('subscription status is not read from the removed endpoint anymore', async () => {
    const res = await request(app)
      .get(`/api/payment/bakong/check/${md5()}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  test('staff cannot mark a session paid', async () => {
    const sessionId = await createSession(tenantPlanId, md5());

    await expectDenied(app, {
      method: 'post',
      path: `/api/payment/admin/sessions/${sessionId}/mark-paid`,
      deniedToken: staffToken,
      allowedToken: superToken,
      body: { reason: 'staff denied control' },
      status: 403,
      readRow: () => snapshot(sessionId, tenantPlanId),
    });
  });

  test('tenant admin cannot mark a session paid', async () => {
    const sessionId = await createSession(tenantPlanId, md5());

    await expectDenied(app, {
      method: 'post',
      path: `/api/payment/admin/sessions/${sessionId}/mark-paid`,
      deniedToken: adminToken,
      allowedToken: superToken,
      body: { reason: 'tenant admin denied control' },
      status: 403,
      readRow: () => snapshot(sessionId, tenantPlanId),
    });
  });

  test('mark-paid changes tenants.plan and extends plan_expires_at by exactly one period', async () => {
    const sessionId = await createSession(tenantPlanId, md5(), { plan: 'chain', amount: 49 });

    const res = await markPaid(sessionId, superToken, 'one period');
    expect(res.status).toBe(200);

    const tenant = await pool.query(`SELECT plan, plan_expires_at FROM tenants WHERE id = $1`, [tenantPlanId]);
    expect(tenant.rows[0].plan).toBe('chain');
    expect(new Date(tenant.rows[0].plan_expires_at).toISOString()).toBe('2030-02-01T00:00:00.000Z');
  });

  test('manual mark-paid records the real admin id in ledger user_id and verified_by', async () => {
    const sessionId = await createSession(tenantPlanId, md5());

    const res = await markPaid(sessionId, superToken, 'manual test');
    expect(res.status).toBe(200);

    const session = await pool.query(`SELECT status, verified_by FROM khqr_sessions WHERE id = $1`, [sessionId]);
    expect(session.rows[0].status).toBe('PAID');
    expect(session.rows[0].verified_by).toBe(`manual:${superId}`);

    const log = await pool.query(
      `SELECT user_id FROM tbl_activity_logs WHERE tenant_id = $1 AND action = 'SUBSCRIPTION_MANUAL_PAID' ORDER BY id DESC LIMIT 1`,
      [tenantPlanId]
    );
    expect(log.rows[0].user_id).toBe(superId);
  });

  test('mark-paid audit row stores the reason and the admin id', async () => {
    const sessionId = await createSession(tenantPlanId, md5());
    const reason = `bank slip ${runId}`;

    const res = await markPaid(sessionId, superToken, reason);
    expect(res.status).toBe(200);

    const log = await pool.query(
      `SELECT user_id, action, details FROM tbl_activity_logs WHERE tenant_id = $1 ORDER BY id DESC LIMIT 1`,
      [tenantPlanId]
    );
    const details = JSON.parse(log.rows[0].details);
    expect(log.rows[0].user_id).toBe(superId);
    expect(log.rows[0].action).toBe('SUBSCRIPTION_MANUAL_PAID');
    expect(details.reason).toBe(reason);
  });

  test('a repeat mark-paid call does not extend the plan twice', async () => {
    const sessionId = await createSession(tenantPlanId, md5());
    const countLogs = async () => (await pool.query(
      `SELECT count(*)::int AS cnt FROM tbl_activity_logs WHERE tenant_id = $1 AND action = 'SUBSCRIPTION_MANUAL_PAID'`,
      [tenantPlanId]
    )).rows[0].cnt;

    const before = await countLogs();
    const first = await markPaid(sessionId, superToken, 'first call');
    expect(first.status).toBe(200);

    const second = await markPaid(sessionId, superToken, 'repeat call');
    expect(second.status).toBe(200);

    const tenant = await pool.query(`SELECT plan_expires_at FROM tenants WHERE id = $1`, [tenantPlanId]);
    expect(new Date(tenant.rows[0].plan_expires_at).toISOString()).toBe('2030-02-01T00:00:00.000Z');

    expect(await countLogs()).toBe(before + 1);
  });

  test('mark-paid with an empty reason returns 400 and leaves the session pending', async () => {
    const sessionId = await createSession(tenantPlanId, md5());
    const before = await snapshot(sessionId, tenantPlanId);

    const res = await markPaid(sessionId, superToken, '');

    expect(res.status).toBe(400);
    expect(await snapshot(sessionId, tenantPlanId)).toEqual(before);
  });

  test('mark-paid with a whitespace-only reason returns 400 and leaves the session pending', async () => {
    const sessionId = await createSession(tenantPlanId, md5());
    const before = await snapshot(sessionId, tenantPlanId);

    const res = await markPaid(sessionId, superToken, '   ');

    expect(res.status).toBe(400);
    expect(await snapshot(sessionId, tenantPlanId)).toEqual(before);
  });

  test('mark-paid for a missing session returns 404 and writes no ledger row', async () => {
    const countLogs = async () => (await pool.query(
      `SELECT count(*)::int AS cnt FROM tbl_activity_logs WHERE tenant_id = $1 AND action = 'SUBSCRIPTION_MANUAL_PAID'`,
      [tenantPlanId]
    )).rows[0].cnt;
    const before = await countLogs();

    const res = await markPaid(999999999, superToken, 'missing session');

    expect(res.status).toBe(404);
    expect(await countLogs()).toBe(before);
  });

  test('renewal before expiry extends from the existing expiry, not from now', async () => {
    const sessionId = await createSession(tenantPlanId, md5());
    await pool.query(
      `UPDATE tenants SET plan_expires_at = NOW() + interval '10 days' WHERE id = $1`,
      [tenantPlanId]
    );
    const expected = (await pool.query(
      `SELECT (plan_expires_at + interval '1 month') AS expires FROM tenants WHERE id = $1`,
      [tenantPlanId]
    )).rows[0].expires;

    const res = await markPaid(sessionId, superToken, 'early renewal');

    expect(res.status).toBe(200);
    const tenant = await pool.query(`SELECT plan_expires_at FROM tenants WHERE id = $1`, [tenantPlanId]);
    expect(new Date(tenant.rows[0].plan_expires_at).toISOString()).toBe(new Date(expected).toISOString());
  });

  test('two different sessions marked paid in a row both succeed', async () => {
    const firstSession = await createSession(tenantPlanId, md5());
    const secondSession = await createSession(tenantPlanId, md5());
    const countLogs = async () => (await pool.query(
      `SELECT count(*)::int AS cnt FROM tbl_activity_logs WHERE tenant_id = $1 AND action = 'SUBSCRIPTION_MANUAL_PAID'`,
      [tenantPlanId]
    )).rows[0].cnt;
    const before = await countLogs();

    const first = await markPaid(firstSession, superToken, 'first session');
    const second = await markPaid(secondSession, superToken, 'second session');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await countLogs()).toBe(before + 2);
    const tenant = await pool.query(`SELECT plan_expires_at FROM tenants WHERE id = $1`, [tenantPlanId]);
    expect(new Date(tenant.rows[0].plan_expires_at).toISOString()).toBe('2030-03-01T00:00:00.000Z');
  });
});
