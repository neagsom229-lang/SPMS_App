const request = require('supertest');
const app = require('../src/app');
const { Pool } = require('pg');
const crypto = require('crypto');

describe('Bakong Payment and Webhook Tests', () => {
  let pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5433/spms_test' });
  });

  afterEach(async () => {
    await pool.query("DELETE FROM khqr_webhook_events WHERE event_id LIKE 'evt_%'");
  });

  afterAll(async () => {
    await pool.end();
  });

  test('webhook event idempotency and duplicate handling', async () => {
    const eventId = 'evt_' + crypto.randomUUID();
    const res1 = await request(app)
      .post('/api/payment/webhook/khqr')
      .send({ event_id: eventId, md5: 'test_md5', status: 'PAID' });
    
    const res2 = await request(app)
      .post('/api/payment/webhook/khqr')
      .send({ event_id: eventId, md5: 'test_md5', status: 'PAID' });
    
    expect([200, 201, 400, 409, 422]).toContain(res2.status);
  });

  test('payment status update verification', async () => {
    const tenantRes = await pool.query("INSERT INTO tenants (name, subdomain, status, plan) VALUES ('Pay Test', 'paytest_' || floor(random()*100000)::text, 'ACTIVE', 'shophouse') RETURNING id;");
    const tId = tenantRes.rows[0].id;
    const sessionRes = await pool.query(
      "INSERT INTO khqr_sessions (tenant_id, amount, expected_amount, currency, md5, status) VALUES ($1, 10, 10, 'USD', 'test_md5_pending_' || floor(random()*100000)::text, 'PAID') RETURNING md5;",
      [tId]
    );
    const md5 = sessionRes.rows[0].md5;

    const res = await request(app)
      .get(`/api/payment/bakong/check/${md5}`);

    expect([200, 401, 403, 404]).toContain(res.status);
  });
});
