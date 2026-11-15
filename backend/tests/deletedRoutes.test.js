// backend/tests/deletedRoutes.test.js
const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/app');
const db = require('../src/config/postgres');

const runId = crypto.randomBytes(4).toString('hex');
const subdomain = `tdel-${runId}`;

describe('Deleted routes are gone (404)', () => {
  let token;

  beforeAll(async () => {
    await db.query('DELETE FROM tenants WHERE subdomain = $1', [subdomain]);

    await request(app)
      .post('/api/auth/register-client')
      .send({
        businessName: 'Deleted Routes Tenant',
        email: subdomain + '@test.com',
        password: 'Qa!123456',
        subdomain,
      });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: subdomain + '_admin', password: 'Qa!123456' });
    token = login.body.token;
  });

  afterAll(async () => {
    await db.query('DELETE FROM tenants WHERE subdomain = $1', [subdomain]);
  });

  test('GET /api/auth/test is gone', async () => {
    const res = await request(app).get('/api/auth/test');
    expect(res.status).toBe(404);
  });

  test('DELETE /api/activity-logs is gone', async () => {
    const res = await request(app)
      .delete('/api/activity-logs')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test('DELETE /api/suppliers/bulk is gone', async () => {
    const res = await request(app)
      .delete('/api/suppliers/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [] });
    expect(res.status).toBe(404);
  });

  test('GET /api/dashboard/system/stats is gone', async () => {
    const res = await request(app)
      .get('/api/dashboard/system/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test('GET /api/dashboard/recent is gone', async () => {
    const res = await request(app)
      .get('/api/dashboard/recent')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test('GET /api/dashboard/low-stock is gone', async () => {
    const res = await request(app)
      .get('/api/dashboard/low-stock')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test('GET /api/dashboard/pending is gone', async () => {
    const res = await request(app)
      .get('/api/dashboard/pending')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test('GET /api/payment/bakong/check/:md5 is gone', async () => {
    const res = await request(app)
      .get(`/api/payment/bakong/check/${crypto.randomBytes(16).toString('hex')}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
