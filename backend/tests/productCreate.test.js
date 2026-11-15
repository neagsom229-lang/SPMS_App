// backend/tests/productCreate.test.js
//
// 9g: a product create that fails must leave no product row behind.
// backend/src/routes/products.js inserts tbl_products and tbl_stock inside one
// transaction, so a rejected quantity cannot leave an orphan product that has
// no stock row.
const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/app');
const db = require('../src/config/postgres');

const runId = crypto.randomBytes(4).toString('hex');
const prefix = `tspc-${runId}-`;

describe('Product Create Transaction Tests', () => {
  let tokenA, tenantId;

  beforeAll(async () => {
    await db.query(`DELETE FROM tenants WHERE subdomain LIKE $1`, [prefix + '%']);
    const sub = prefix + 'shop';
    const reg = await request(app).post('/api/auth/register-client').send({ businessName: sub, email: sub + '@test.com', password: 'Qa!123456', subdomain: sub });
    const login = await request(app).post('/api/auth/login').send({ username: sub + '_admin', password: 'Qa!123456' });
    tokenA = login.body.token || reg.body.token;
    const t = await db.query('SELECT id FROM tenants WHERE subdomain = $1', [sub]);
    tenantId = t.rows[0].id;
  });

  afterAll(async () => {
    try {
      await db.query(`DELETE FROM tenants WHERE subdomain LIKE $1`, [prefix + '%']);
    } catch (e) {}
    await db.end();
  });

  test('product create with an invalid quantity is rejected and leaves no product row', async () => {
    const barcode = 'BADQTY-' + runId;
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', 'Bearer ' + tokenA)
      .send({ name: 'Bad Qty ' + runId, barcode, cost: 5, price: 20, stock: -1 });

    expect(res.status).toBe(400);

    const rows = await db.query(
      'SELECT id FROM tbl_products WHERE tenant_id = $1 AND barcode = $2',
      [tenantId, barcode]
    );
    expect(rows.rows.length).toBe(0);
  });
});
