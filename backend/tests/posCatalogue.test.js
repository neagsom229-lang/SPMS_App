// backend/tests/posCatalogue.test.js
//
// Phase 10d: SellPage ?q= search. The backend accepts q as an alias for the
// existing name / name_kh / barcode ILIKE filter, tenant-scoped, and SellPage
// requests limit=50 while searching.
const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/app');
const db = require('../src/config/postgres');

const runId = crypto.randomBytes(4).toString('hex');
const prefix = `tpc-${runId}-`;

describe('POS catalogue ?q= search', () => {
  let tokenA, tokenB;
  let tenantAId, tenantBId;
  let oldestId;
  let customerAId;

  const OLDEST_NAME = 'Oldest Widget XYZ';
  const OLDEST_NAME_KH = 'កូបងចាស់របស់ហាង';
  const OLDEST_BARCODE = 'OLDEST-BARCODE-0001';

  const search = (token, q, limit = 50) =>
    request(app)
      .get(`/api/products?q=${encodeURIComponent(q)}&limit=${limit}`)
      .set('Authorization', 'Bearer ' + token);

  const createTenant = async (label) => {
    const subdomain = `${prefix}${label}`;
    await db.query('DELETE FROM tenants WHERE subdomain = $1', [subdomain]);

    await request(app)
      .post('/api/auth/register-client')
      .send({
        businessName: `POS Catalogue ${label}`,
        email: subdomain + '@test.com',
        password: 'Qa!123456',
        subdomain,
      });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: subdomain + '_admin', password: 'Qa!123456' });

    const tRes = await db.query('SELECT id FROM tenants WHERE subdomain = $1', [subdomain]);
    return { token: login.body.token, tenantId: tRes.rows[0].id };
  };

  beforeAll(async () => {
    const a = await createTenant('a');
    tokenA = a.token;
    tenantAId = a.tenantId;

    // The oldest product is inserted first, so it has the lowest id and would
    // fall outside a 200-newest list of a 260-product tenant.
    const oldest = await db.query(
      `INSERT INTO tbl_products (name, name_kh, barcode, price, stock, tenant_id)
       VALUES ($1, $2, $3, 10, 100, $4) RETURNING id`,
      [OLDEST_NAME, OLDEST_NAME_KH, OLDEST_BARCODE, tenantAId]
    );
    oldestId = oldest.rows[0].id;

    await db.query(
      `INSERT INTO tbl_products (name, name_kh, barcode, price, stock, tenant_id)
       SELECT 'Filler Product ' || g, ' filler Khmer ' || g, 'FILL-' || g, 5, 50, $1
       FROM generate_series(1, 259) g`,
      [tenantAId]
    );

    const customer = await db.query(
      `INSERT INTO tbl_customers (cus_id, name, phone, tenant_id) VALUES ($1, $2, $3, $4) RETURNING id`,
      [`PC-${runId}`, 'Catalog Customer Anne', '012999888', tenantAId]
    );
    customerAId = customer.rows[0].id;

    const b = await createTenant('b');
    tokenB = b.token;
    tenantBId = b.tenantId;
  });

  afterAll(async () => {
    await db.query('DELETE FROM tenants WHERE id IN ($1, $2)', [tenantAId, tenantBId]);
  });

  test('q finds the oldest product by name', async () => {
    const res = await search(tokenA, 'Oldest Widget');
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].id).toBe(oldestId);
    expect(res.body.products[0].name).toBe(OLDEST_NAME);
  });

  test('q finds the oldest product by name_kh', async () => {
    const res = await search(tokenA, 'កូបងចាស់');
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].id).toBe(oldestId);
    expect(res.body.products[0].name_kh).toBe(OLDEST_NAME_KH);
  });

  test('q finds the oldest product by barcode', async () => {
    const res = await search(tokenA, OLDEST_BARCODE);
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].id).toBe(oldestId);
    expect(res.body.products[0].barcode).toBe(OLDEST_BARCODE);
  });

  test('q results never exceed 50 rows', async () => {
    const res = await search(tokenA, 'Filler Product', 50);
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(50);
    expect(res.body.pagination.total).toBe(259);
    expect(res.body.pagination.limit).toBe(50);
  });

  test('tenant B cannot find tenant A product by q', async () => {
    const res = await search(tokenB, 'Oldest Widget');
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(0);
    expect(res.body.pagination.total).toBe(0);
  });

  test('q on /customers finds the customer only for the owning tenant', async () => {
    const own = await request(app)
      .get('/api/customers?q=Catalog Customer Anne')
      .set('Authorization', 'Bearer ' + tokenA);
    expect(own.status).toBe(200);
    expect(Array.isArray(own.body)).toBe(true);
    expect(own.body).toHaveLength(1);
    expect(own.body[0].id).toBe(customerAId);

    const other = await request(app)
      .get('/api/customers?q=Catalog Customer Anne')
      .set('Authorization', 'Bearer ' + tokenB);
    expect(other.status).toBe(200);
    expect(Array.isArray(other.body)).toBe(true);
    expect(other.body).toHaveLength(0);
  });
});
