// New tests for D.b: server-side product stats, sort and all-rows report export.
// No existing test is edited.
const { test, expect } = require('@playwright/test');
const { Client } = require('../backend/node_modules/pg');
const { testDatabaseUrl } = require('../backend/scripts/_guard');
const { API_URL } = require('../backend/scripts/e2e-ports');

const API = process.env.E2E_API_URL || API_URL;
const SUFFIX = String(Date.now());
let client;
let token;
let tenantId;
let seedCount;

async function api(path) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

test.beforeAll(async () => {
  client = new Client({ connectionString: testDatabaseUrl() });
  await client.connect();
  tenantId = (await client.query("SELECT id FROM tenants WHERE subdomain='demo'")).rows[0].id;
  for (let i = 0; i < 40; i += 1) {
    try { const h = await fetch(`${API.replace(/\/api$/, '')}/health`); if (h.ok) break; } catch { /* not ready */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  const login = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'demo_admin', password: 'Demo1234!' }),
  });
  const auth = await login.json();
  token = auth.token;
  const base = (await client.query('SELECT COUNT(*)::int n FROM tbl_products WHERE tenant_id=$1', [tenantId])).rows[0].n;
  seedCount = 521 - base;
  const cat = await client.query('INSERT INTO tbl_categories (name, tenant_id) VALUES ($1,$2) RETURNING id', [`SCOPE ${SUFFIX}`, tenantId]);
  const sup = await client.query('SELECT id FROM tbl_suppliers WHERE tenant_id=$1 LIMIT 1', [tenantId]);
  for (let i = 1; i <= seedCount; i += 1) {
    await client.query(
      `INSERT INTO tbl_products (name, barcode, category_id, supplier_id, price, cost, stock, tenant_id, status)
       VALUES ($1,$2,$3,$4,10,2,10,$5,'Active')`,
      [`SCOPE${SUFFIX} ${String(i).padStart(4, '0')}`, `SCOPE-${SUFFIX}-${i}`, cat.rows[0].id, sup.rows[0].id, tenantId]
    );
  }
});

test.afterAll(async () => {
  if (!client) return;
  await client.query('DELETE FROM tbl_products WHERE barcode LIKE $1', [`SCOPE-${SUFFIX}-%`]);
  await client.query('DELETE FROM tbl_categories WHERE name=$1', [`SCOPE ${SUFFIX}`]);
  await client.end();
});

test('GET /products/stats covers all tenant products', async () => {
  const r = await api('/products/stats');
  expect(r.status).toBe(200);
  expect(r.body.total).toBe(521);
  expect(r.body.active).toBeGreaterThanOrEqual(seedCount);
});

test('GET /products sort=NAME_EN&order=asc is server-side', async () => {
  const r = await api('/products?sort=NAME_EN&order=asc&limit=5');
  expect(r.status).toBe(200);
  const names = r.body.products.map((p) => p.name_en || p.name);
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
});

test('GET /reports/rows/products returns all rows, not one page', async () => {
  const r = await api('/reports/rows/products');
  expect(r.status).toBe(200);
  expect(Array.isArray(r.body.rows)).toBe(true);
  expect(r.body.rows.length).toBeGreaterThan(200);
});
