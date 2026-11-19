// New tests for C2b: create-user roles, legacy role display, activity-log access.
// No existing test is edited.
const { test, expect } = require('@playwright/test');
const { Client } = require('../backend/node_modules/pg');
const jwt = require('../backend/node_modules/jsonwebtoken');
const bcrypt = require('../backend/node_modules/bcryptjs');
const { testDatabaseUrl } = require('../backend/scripts/_guard');
const { API_URL } = require('../backend/scripts/e2e-ports');

const API = process.env.E2E_API_URL || API_URL;
const SECRET = process.env.E2E_JWT_SECRET || 'e2e-only-jwt-secret-0123456789abcdef';
const SUFFIX = String(Date.now());
let client;
let ctx = {};

async function adminHeaders() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'demo_admin', password: 'Demo1234!' }),
  });
  const auth = await res.json();
  return { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json', 'x-tenant-id': String(auth.user.tenant.id) };
}

async function storedRole(username) {
  const r = await client.query('SELECT role FROM tbl_users WHERE username=$1', [username]);
  return r.rows[0] ? r.rows[0].role : null;
}

async function createViaApi(request, role) {
  const username = `c2b_${role.replace(/\W/g, '')}_${SUFFIX}_${Math.random().toString(16).slice(2)}`.toLowerCase();
  const res = await request.post(`${API}/users`, {
    headers: await adminHeaders(),
    data: { username, email: `${username}@e2e.test`, password: 'Test1234!', fullname: `C2B ${role}`, role, status: 'ACTIVE' },
  });
  return { res, username };
}

async function tokenFor(role) {
  const username = `c2b_tok_${role.replace(/\W/g, '')}_${SUFFIX}_${Math.random().toString(16).slice(2)}`.toLowerCase();
  await client.query(
    `INSERT INTO tbl_users (username,email,password,fullname,role,status,tenant_id,must_change_password)
     VALUES ($1,$2,$3,$4,$5,'ACTIVE',$6,FALSE)`,
    [username, `${username}@e2e.test`, bcrypt.hashSync('Test1234!', 10), username, role, ctx.tenantId]
  );
  const id = (await client.query('SELECT userid FROM tbl_users WHERE username=$1', [username])).rows[0].userid;
  return jwt.sign({ userId: id, username, role, tenantId: ctx.tenantId, isSuperAdmin: false }, SECRET, { expiresIn: '1h' });
}

test.beforeAll(async () => {
  const url = testDatabaseUrl();
  const parsed = new URL(url);
  if (parsed.port !== '15432' || !parsed.pathname.endsWith('_test')) {
    throw new Error(`refusing to run: DB target is ${parsed.hostname}:${parsed.port}${parsed.pathname}`);
  }
  client = new Client({ connectionString: url });
  await client.connect();
  await client.query("DELETE FROM tbl_users WHERE username LIKE 'c2b_%'");
  const t = await client.query("SELECT id FROM tenants WHERE subdomain='demo'");
  ctx.tenantId = t.rows[0].id;
});

test.afterAll(async () => {
  if (!client) return;
  await client.query("DELETE FROM tbl_users WHERE username LIKE 'c2b_%'");
  await client.end();
});

test('POST /users accepts Admin', async ({ request }) => {
  const { res, username } = await createViaApi(request, 'Admin');
  expect(res.status()).toBe(201);
  expect(await storedRole(username)).toBe('Admin');
});

test('POST /users accepts Staff', async ({ request }) => {
  const { res, username } = await createViaApi(request, 'Staff');
  expect(res.status()).toBe(201);
  expect(await storedRole(username)).toBe('Staff');
});

test('POST /users accepts Viewer', async ({ request }) => {
  const { res, username } = await createViaApi(request, 'Viewer');
  expect(res.status()).toBe(201);
  expect(await storedRole(username)).toBe('Viewer');
});

test('POST /users rejects Super Admin', async ({ request }) => {
  const { res, username } = await createViaApi(request, 'Super Admin');
  expect(res.status()).toBe(400);
  expect(await storedRole(username)).toBeNull();
});

test('legacy Cashier edit shows Cashier and keeps it', async ({ browser }) => {
  const username = `c2b_cash_${SUFFIX}`;
  await client.query(
    `INSERT INTO tbl_users (username,email,password,fullname,role,status,tenant_id,must_change_password)
     VALUES ($1,$2,$3,'Cash Legacy','Cashier','ACTIVE',$4,FALSE)`,
    [username, `${username}@e2e.test`, bcrypt.hashSync('Test1234!', 10), ctx.tenantId]
  );
  const headers = await adminHeaders();
  const context = await browser.newContext({ viewport: { width: 1344, height: 960 } });
  await context.addInitScript((s) => {
    localStorage.setItem('token', s.token);
    localStorage.setItem('user', s.user);
    localStorage.setItem('tenant', s.tenant);
  }, {
    token: headers.Authorization.replace('Bearer ', ''),
    user: JSON.stringify({ username: 'demo_admin', role: 'Admin' }),
    tenant: JSON.stringify({ id: ctx.tenantId, subdomain: 'demo' }),
  });
  const page = await context.newPage();
  await page.goto('/users');
  await page.getByText(username, { exact: true }).first().waitFor({ timeout: 15000 });
  await page.getByTitle('List view').click();
  await page.locator('tbody tr').filter({ hasText: username }).getByTitle('Edit').first().click();
  const select = page.locator('select').filter({ has: page.locator('option[value="Admin"]') }).first();
  await expect(select).toHaveValue('Cashier');
  await page.getByPlaceholder('Enter full name').fill('Cash Legacy Edited');
  await page.getByRole('button', { name: 'Update User' }).click();
  await expect.poll(async () => (await client.query('SELECT fullname FROM tbl_users WHERE username=$1', [username])).rows[0]?.fullname).toBe('Cash Legacy Edited');
  expect(await storedRole(username)).toBe('Cashier');
  await context.close();
});

test('GET activity-logs: Viewer forbidden', async ({ request }) => {
  const token = await tokenFor('Viewer');
  const res = await request.get(`${API}/activity-logs`, { headers: { Authorization: `Bearer ${token}` } });
  expect(res.status()).toBe(403);
});

test('GET activity-logs: Staff allowed', async ({ request }) => {
  const token = await tokenFor('Staff');
  const res = await request.get(`${API}/activity-logs`, { headers: { Authorization: `Bearer ${token}` } });
  expect(res.status()).toBe(200);
});

test('GET activity-logs: Admin allowed', async ({ request }) => {
  const token = await tokenFor('Admin');
  const res = await request.get(`${API}/activity-logs`, { headers: { Authorization: `Bearer ${token}` } });
  expect(res.status()).toBe(200);
});
