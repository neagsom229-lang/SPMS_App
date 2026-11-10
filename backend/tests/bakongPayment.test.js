jest.mock('../src/services/bakongVerifier', () => ({ verifyTransaction: jest.fn() }));

const request = require('supertest');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const app = require('../src/app');
const { verifyTransaction } = require('../src/services/bakongVerifier');

const runId = crypto.randomBytes(4).toString('hex');
const prefix = `payt-${runId}-`;
const WEBHOOK_SECRET = process.env.KHQR_WEBHOOK_SECRET || 'secret';

function signBody(body) {
  return crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
}

describe('Bakong payment routes', () => {
  let pool;
  let tenantPlanId;
  let tenantOtherId;
  let adminToken;
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

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    tenantPlanId = await createTenant('shophouse');
    tenantOtherId = await createTenant('chain');
    await createUser(`${prefix}admin`, tenantPlanId);
    await createUser(`${prefix}other`, tenantOtherId);
    superId = await createUser(`${prefix}super`, null, 'Admin', true);

    adminToken = await login(`${prefix}admin`);
    otherToken = await login(`${prefix}other`);
    superToken = await login(`${prefix}super`);
  });

  beforeEach(async () => {
    verifyTransaction.mockReset();
    await pool.query(`UPDATE tenants SET plan_expires_at = '2030-01-01T00:00:00Z' WHERE id = $1`, [tenantPlanId]);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM khqr_webhook_events WHERE event_id LIKE $1`, [`${prefix}%`]);
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

  test('invalid md5 is rejected with 400', async () => {
    const res = await request(app)
      .get('/api/payment/bakong/check/not-an-md5')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  test('another tenant cannot read a session md5 (404)', async () => {
    const sessionMd5 = md5();
    await createSession(tenantPlanId, sessionMd5);
    const res = await request(app)
      .get(`/api/payment/bakong/check/${sessionMd5}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(404);
  });

  test('pricing is server-side: client amount ignored, invalid plan/period/currency and period >= 120 rejected', async () => {
    const legit = await request(app)
      .post('/api/payment/bakong/create-qr')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ plan: 'shophouse', period_months: 1, currency: 'USD', amount: 1 });
    expect(legit.status).toBe(200);
    expect(Number(legit.body.amount)).toBe(19);

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

  test('20 concurrent polls activate exactly once, extend by one period and write one activity log', async () => {
    const sessionMd5 = md5();
    const sessionId = await createSession(tenantPlanId, sessionMd5);
    verifyTransaction.mockResolvedValue({ state: 'PAID', hash: `HASH-${runId}-A`, raw: { ok: true } });

    const responses = await Promise.all(
      Array.from({ length: 20 }, () =>
        request(app).get(`/api/payment/bakong/check/${sessionMd5}`).set('Authorization', `Bearer ${adminToken}`)
      )
    );
    expect(responses.every(r => r.status === 200)).toBe(true);

    const session = await pool.query(`SELECT status FROM khqr_sessions WHERE id = $1`, [sessionId]);
    expect(session.rows[0].status).toBe('PAID');

    const tenant = await pool.query(`SELECT plan_expires_at FROM tenants WHERE id = $1`, [tenantPlanId]);
    expect(new Date(tenant.rows[0].plan_expires_at).toISOString()).toBe('2030-02-01T00:00:00.000Z');

    const logs = await pool.query(`SELECT count(*)::int AS cnt FROM tbl_activity_logs WHERE tenant_id = $1 AND action = 'SUBSCRIPTION_PAID'`, [tenantPlanId]);
    expect(logs.rows[0].cnt).toBe(1);
  });

  test('amount/currency/account mismatch ends FAILED_MISMATCH and never PAID', async () => {
    const sessionMd5 = md5();
    const sessionId = await createSession(tenantPlanId, sessionMd5);
    verifyTransaction.mockResolvedValue({ state: 'FAILED_MISMATCH', hash: `HASH-${runId}-M`, raw: { mismatch: true } });

    const res = await request(app)
      .get(`/api/payment/bakong/check/${sessionMd5}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('VERIFYING_ERROR');

    const session = await pool.query(`SELECT status FROM khqr_sessions WHERE id = $1`, [sessionId]);
    expect(session.rows[0].status).toBe('FAILED_MISMATCH');

    const tenant = await pool.query(`SELECT plan_expires_at FROM tenants WHERE id = $1`, [tenantPlanId]);
    expect(new Date(tenant.rows[0].plan_expires_at).toISOString()).toBe('2030-01-01T00:00:00.000Z');
  });

  test('provider 401/403/429/500/timeout map to VERIFYING_ERROR with no activation', async () => {
    for (const errorKind of ['AUTH', 'FORBIDDEN_OR_GEO', 'RATE', 'UPSTREAM', 'NETWORK']) {
      const sessionMd5 = md5();
      const sessionId = await createSession(tenantPlanId, sessionMd5);
      verifyTransaction.mockResolvedValue({ state: 'ERROR', errorKind });

      const res = await request(app)
        .get(`/api/payment/bakong/check/${sessionMd5}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('VERIFYING_ERROR');

      const session = await pool.query(`SELECT status FROM khqr_sessions WHERE id = $1`, [sessionId]);
      expect(session.rows[0].status).toBe('PENDING');
    }

    const tenant = await pool.query(`SELECT plan_expires_at FROM tenants WHERE id = $1`, [tenantPlanId]);
    expect(new Date(tenant.rows[0].plan_expires_at).toISOString()).toBe('2030-01-01T00:00:00.000Z');
  });

  test('a bakong_hash already used by another session does not activate the second session', async () => {
    const firstMd5 = md5();
    const firstId = await createSession(tenantPlanId, firstMd5);
    verifyTransaction.mockResolvedValue({ state: 'PAID', hash: `HASH-${runId}-S`, raw: {} });

    const first = await request(app)
      .get(`/api/payment/bakong/check/${firstMd5}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(first.status).toBe(200);
    const firstRow = await pool.query(`SELECT status FROM khqr_sessions WHERE id = $1`, [firstId]);
    expect(firstRow.rows[0].status).toBe('PAID');

    const secondMd5 = md5();
    const secondId = await createSession(tenantPlanId, secondMd5);
    const second = await request(app)
      .get(`/api/payment/bakong/check/${secondMd5}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(second.status).toBe(200);

    const secondRow = await pool.query(`SELECT status FROM khqr_sessions WHERE id = $1`, [secondId]);
    expect(secondRow.rows[0].status).not.toBe('PAID');

    const tenant = await pool.query(`SELECT plan_expires_at FROM tenants WHERE id = $1`, [tenantPlanId]);
    expect(new Date(tenant.rows[0].plan_expires_at).toISOString()).toBe('2030-02-01T00:00:00.000Z');
  });

  test('simulator route returns 404 when NODE_ENV=production', async () => {
    const sessionMd5 = md5();
    await createSession(tenantPlanId, sessionMd5);
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const res = await request(app)
        .post(`/api/payment/simulate-payment/${sessionMd5}`)
        .set('Authorization', `Bearer ${superToken}`);
      expect(res.status).toBe(404);
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  test('webhook with a bad signature returns 401', async () => {
    const body = JSON.stringify({ eventId: `${prefix}bad-sig-${runId}`, md5: md5() });
    const res = await request(app)
      .post('/api/payment/webhook/khqr')
      .set('Content-Type', 'application/json')
      .set('x-khqr-signature', 'deadbeef')
      .send(body);
    expect(res.status).toBe(401);
  });

  test('replayed webhook does not activate twice', async () => {
    const sessionMd5 = md5();
    const sessionId = await createSession(tenantPlanId, sessionMd5);
    verifyTransaction.mockResolvedValue({ state: 'PAID', hash: `HASH-${runId}-W`, raw: {} });

    const body = JSON.stringify({ eventId: `${prefix}replay-${runId}`, md5: sessionMd5 });
    const signature = signBody(body);

    const first = await request(app)
      .post('/api/payment/webhook/khqr')
      .set('Content-Type', 'application/json')
      .set('x-khqr-signature', signature)
      .send(body);
    expect(first.status).toBe(200);

    const second = await request(app)
      .post('/api/payment/webhook/khqr')
      .set('Content-Type', 'application/json')
      .set('x-khqr-signature', signature)
      .send(body);
    expect(second.status).toBe(200);

    const logs = await pool.query(
      `SELECT count(*)::int AS cnt FROM tbl_activity_logs WHERE tenant_id = $1 AND action = 'SUBSCRIPTION_WEBHOOK_PAID'`,
      [tenantPlanId]
    );
    expect(logs.rows[0].cnt).toBe(1);
    const events = await pool.query(`SELECT count(*)::int AS cnt FROM khqr_webhook_events WHERE event_id = $1`, [`${prefix}replay-${runId}`]);
    expect(events.rows[0].cnt).toBe(1);
    const session = await pool.query(`SELECT status FROM khqr_sessions WHERE id = $1`, [sessionId]);
    expect(session.rows[0].status).toBe('PAID');
  });

  test('valid webhook whose provider says unpaid performs no activation', async () => {
    const sessionMd5 = md5();
    const sessionId = await createSession(tenantPlanId, sessionMd5);
    verifyTransaction.mockResolvedValue({ state: 'NOT_FOUND', raw: {} });
    const before = await pool.query(
      `SELECT count(*)::int AS cnt FROM tbl_activity_logs WHERE tenant_id = $1 AND action = 'SUBSCRIPTION_WEBHOOK_PAID'`,
      [tenantPlanId]
    );

    const body = JSON.stringify({ eventId: `${prefix}unpaid-${runId}`, md5: sessionMd5 });
    const res = await request(app)
      .post('/api/payment/webhook/khqr')
      .set('Content-Type', 'application/json')
      .set('x-khqr-signature', signBody(body))
      .send(body);
    expect(res.status).toBe(200);

    const session = await pool.query(`SELECT status FROM khqr_sessions WHERE id = $1`, [sessionId]);
    expect(session.rows[0].status).toBe('PENDING');
    const after = await pool.query(
      `SELECT count(*)::int AS cnt FROM tbl_activity_logs WHERE tenant_id = $1 AND action = 'SUBSCRIPTION_WEBHOOK_PAID'`,
      [tenantPlanId]
    );
    expect(after.rows[0].cnt).toBe(before.rows[0].cnt);
    const tenant = await pool.query(`SELECT plan_expires_at FROM tenants WHERE id = $1`, [tenantPlanId]);
    expect(new Date(tenant.rows[0].plan_expires_at).toISOString()).toBe('2030-01-01T00:00:00.000Z');
  });

  test('valid signed webhook through the real app processes the payment', async () => {
    const sessionMd5 = md5();
    const sessionId = await createSession(tenantPlanId, sessionMd5);
    verifyTransaction.mockResolvedValue({ state: 'PAID', hash: `HASH-${runId}-V`, raw: {} });

    const body = JSON.stringify({ eventId: `${prefix}valid-${runId}`, md5: sessionMd5 });
    const res = await request(app)
      .post('/api/payment/webhook/khqr')
      .set('Content-Type', 'application/json')
      .set('x-khqr-signature', signBody(body))
      .send(body);
    expect(res.status).toBe(200);

    const session = await pool.query(`SELECT status, verified_by FROM khqr_sessions WHERE id = $1`, [sessionId]);
    expect(session.rows[0].status).toBe('PAID');
    expect(session.rows[0].verified_by).toBe('webhook');

    const tenant = await pool.query(`SELECT plan_expires_at FROM tenants WHERE id = $1`, [tenantPlanId]);
    expect(new Date(tenant.rows[0].plan_expires_at).toISOString()).toBe('2030-02-01T00:00:00.000Z');
  });

  test('manual mark-paid records the real admin id in ledger user_id and verified_by', async () => {
    const sessionMd5 = md5();
    const sessionId = await createSession(tenantPlanId, sessionMd5);

    const res = await request(app)
      .post(`/api/payment/admin/sessions/${sessionId}/mark-paid`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ reason: 'manual test' });
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
});
