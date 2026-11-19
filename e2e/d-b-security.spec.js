// New tests for Batch E security/caps/audit/dev-port checks. No existing test is edited.
const { test, expect } = require('@playwright/test');
const { spawn } = require('child_process');
const net = require('net');
const path = require('path');
const { Client } = require('../backend/node_modules/pg');
const jwt = require('../backend/node_modules/jsonwebtoken');
const bcrypt = require('../backend/node_modules/bcryptjs');
const { testDatabaseUrl } = require('../backend/scripts/_guard');
const { API_URL } = require('../backend/scripts/e2e-ports');

const API = process.env.E2E_API_URL || API_URL;
const SECRET = process.env.E2E_JWT_SECRET || 'e2e-only-jwt-secret-0123456789abcdef';
const S = String(Date.now());
let client;
let tenantA;
let tenantB;
let tokens = {};
let userA;

async function makeUser(role, tenantId, name = null) {
  const uname = `sec_${role.replace(/\W/g, '')}_${S}_${Math.random().toString(16).slice(2)}`.toLowerCase();
  await client.query(
    `INSERT INTO tbl_users (username,email,password,fullname,role,status,tenant_id,must_change_password)
     VALUES ($1,$2,$3,$4,$5,'ACTIVE',$6,FALSE)`,
    [uname, `${uname}@e2e.test`, bcrypt.hashSync('Test1234!', 10), name || uname, role, tenantId]
  );
  const id = (await client.query('SELECT userid FROM tbl_users WHERE username=$1', [uname])).rows[0].userid;
  return {
    id,
    uname,
    token: jwt.sign({ userId: id, username: uname, role, tenantId, isSuperAdmin: false }, SECRET, { expiresIn: '1h' }),
  };
}

async function api(token, pathname) {
  const res = await fetch(`${API}${pathname}`, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  let body = {};
  try { body = await res.json(); } catch { /* empty */ }
  return { status: res.status, body, headers: res.headers };
}

test.beforeAll(async () => {
  client = new Client({ connectionString: testDatabaseUrl() });
  await client.connect();
  tenantA = (await client.query("SELECT id FROM tenants WHERE subdomain='demo'")).rows[0].id;
  const b = await client.query("INSERT INTO tenants (name, subdomain, status, plan) VALUES ($1,$2,'ACTIVE','shophouse') RETURNING id", [`SEC B ${S}`, `sec-b-${S}`]);
  tenantB = b.rows[0].id;
  userA = await makeUser('Admin', tenantA, 'Audit Actor');
  tokens.adminA = userA.token;
  tokens.viewerA = (await makeUser('Viewer', tenantA)).token;
  tokens.adminB = (await makeUser('Admin', tenantB)).token;
  for (let i = 0; i < 40; i += 1) {
    try { const h = await fetch(`${API.replace(/\/api$/, '')}/health`); if (h.ok) break; } catch { /* not ready */ }
    await new Promise((r) => setTimeout(r, 500));
  }
});

test.afterAll(async () => {
  if (!client) return;
  await client.query('DELETE FROM tbl_activity_logs WHERE details LIKE $1', [`%actor=${userA.uname}%`]);
  await client.query("DELETE FROM tbl_users WHERE username LIKE 'sec_%'");
  await client.query("DELETE FROM tenants WHERE subdomain=$1", [`sec-b-${S}`]);
  await client.end();
});

test('tenant B cannot read tenant A stats or report rows', async () => {
  const stats = await api(tokens.adminB, '/products/stats');
  expect(stats.status).toBe(200);
  expect(stats.body.total).toBe(0);
  const rows = await api(tokens.adminB, '/reports/rows/products');
  expect(rows.status).toBe(200);
  expect(rows.body.rows.length).toBe(0);
});

test('Viewer is denied report rows and product stats', async () => {
  expect((await api(tokens.viewerA, '/reports/rows/products')).status).toBe(403);
  expect((await api(tokens.viewerA, '/products/stats')).status).toBe(403);
});

test('sort injection and unknown sort fall back to default order', async () => {
  const evil = await api(tokens.adminA, '/products?sort=' + encodeURIComponent('p.name; DROP TABLE tbl_products; --') + '&order=' + encodeURIComponent('desc; --'));
  expect(evil.status).toBe(200);
  const unknown = await api(tokens.adminA, '/products?sort=NOT_A_COLUMN&order=asc');
  expect(unknown.status).toBe(200);
  const ids = unknown.body.products.map((p) => p.id);
  expect([...ids].sort((a, b) => b - a)).toEqual(ids);
});

test('report rows cap at 10,000 with X-Truncated header', async () => {
  await client.query(
    `INSERT INTO tbl_products (name, barcode, price, cost, stock, tenant_id, status)
     SELECT 'CAP ' || g, 'CAP-${S}-' || g, 1, 1, 1, $1, 'Active' FROM generate_series(1, 10001) g`,
    [tenantB]
  );
  const r = await api(tokens.adminB, '/reports/rows/products');
  expect(r.status).toBe(200);
  expect(r.body.rows.length).toBeLessThanOrEqual(10000);
  expect(r.headers.get('x-truncated')).toBe('true');
  await client.query("DELETE FROM tbl_products WHERE barcode LIKE $1", [`CAP-${S}-%`]);
});

test('order status audit details include the actor username', async () => {
  const cust = (await client.query('SELECT id FROM tbl_customers WHERE tenant_id=$1 LIMIT 1', [tenantA])).rows[0].id;
  const prod = (await client.query('SELECT id FROM tbl_products WHERE tenant_id=$1 LIMIT 1', [tenantA])).rows[0].id;
  const o = await client.query(
    `INSERT INTO tbl_orders (tenant_id, customer_id, total, payment_method, status, order_no, idempotency_key)
     VALUES ($1,$2,20,'Cash','Pending',$3,$4) RETURNING or_id`,
    [tenantA, cust, `SEC-${S}`, `sec-${S}`]
  );
  const res = await fetch(`${API}/orders/${o.rows[0].or_id}/status`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${tokens.adminA}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Confirmed' }),
  });
  expect(res.status).toBe(200);
  const row = await client.query('SELECT details FROM tbl_activity_logs WHERE target_id=$1 ORDER BY id DESC LIMIT 1', [o.rows[0].or_id]);
  expect(row.rows[0].details).toContain(`actor=${userA.uname}`);
  await client.query('DELETE FROM tbl_activity_logs WHERE target_id=$1', [o.rows[0].or_id]);
  await client.query('DELETE FROM tbl_orders WHERE or_id=$1', [o.rows[0].or_id]);
});

test('dev.js fails fast when a dev port is occupied', async () => {
  const blocker = net.createServer();
  await new Promise((resolve) => blocker.listen(5599, '127.0.0.1', resolve));
  const started = Date.now();
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'backend', 'scripts', 'dev.js')], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, DEV_BACKEND_PORT: '5599', DEV_FRONTEND_PORT: '5598' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  child.stdout.on('data', (d) => { out += d.toString(); });
  child.stderr.on('data', (d) => { out += d.toString(); });
  const code = await new Promise((resolve) => { child.on('exit', resolve); setTimeout(() => { child.kill(); resolve(-1); }, 15000); });
  const elapsed = Date.now() - started;
  await new Promise((resolve) => blocker.close(resolve));
  expect(code).not.toBe(0);
  expect(out).toMatch(/port 5599 is already in use/i);
  expect(elapsed).toBeLessThan(8000);
});
