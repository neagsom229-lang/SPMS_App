// New tests for Batch D small items. No existing test is edited.
const { test, expect } = require('@playwright/test');
const { Client } = require('../backend/node_modules/pg');
const jwt = require('../backend/node_modules/jsonwebtoken');
const bcrypt = require('../backend/node_modules/bcryptjs');
const { testDatabaseUrl } = require('../backend/scripts/_guard');
const { API_URL } = require('../backend/scripts/e2e-ports');

const API = process.env.E2E_API_URL || API_URL;
const WEB = String(process.env.E2E_WEB_URL || API_URL).replace(/:5055\/api$/, ':4173');
const SECRET = process.env.E2E_JWT_SECRET || 'e2e-only-jwt-secret-0123456789abcdef';
const SUFFIX = String(Date.now());
let client;
let tenantId;

async function makeUser(role, forced = false) {
  const uname = `small_${role.replace(/\W/g, '')}_${SUFFIX}_${Math.random().toString(16).slice(2)}`.toLowerCase();
  const password = 'Viewer123!';
  await client.query(
    `INSERT INTO tbl_users (username,email,password,fullname,role,status,tenant_id,must_change_password)
     VALUES ($1,$2,$3,$4,$5,'ACTIVE',$6,$7)`,
    [uname, `${uname}@e2e.test`, bcrypt.hashSync(password, 10), uname, role, tenantId, forced]
  );
  const id = (await client.query('SELECT userid FROM tbl_users WHERE username=$1', [uname])).rows[0].userid;
  const token = jwt.sign({ userId: id, username: uname, role, tenantId, isSuperAdmin: false }, SECRET, { expiresIn: '1h' });
  return { uname, id, token, password };
}

test.beforeAll(async () => {
  client = new Client({ connectionString: testDatabaseUrl() });
  await client.connect();
  tenantId = (await client.query("SELECT id FROM tenants WHERE subdomain='demo'")).rows[0].id;
  for (let i = 0; i < 40; i += 1) {
    try {
      const h = await fetch(`${API.replace(/\/api$/, '')}/health`);
      if (h.ok) break;
    } catch { /* not ready */ }
    await new Promise((r) => setTimeout(r, 500));
  }
});

test.afterAll(async () => {
  if (client) {
    await client.query("DELETE FROM tbl_users WHERE username LIKE 'small_%'");
    await client.end();
  }
});

test('case-variant /Auth/Change-Password works for forced Viewer', async ({ request }) => {
  const u = await makeUser('Viewer', true);
  const res = await request.post(`${API}/Auth/Change-Password`, {
    headers: { Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/json' },
    data: { oldPassword: u.password, newPassword: 'ViewerNew123!' },
  });
  expect(res.status()).toBe(200);
});

test('Viewer opening /activity redirects to /dashboard', async ({ browser }) => {
  const u = await makeUser('Viewer');
  const ctx = await browser.newContext({ viewport: { width: 1344, height: 960 } });
  await ctx.addInitScript((s) => {
    localStorage.setItem('token', s.token);
    localStorage.setItem('user', s.user);
    localStorage.setItem('tenant', s.tenant);
  }, { token: u.token, user: JSON.stringify({ username: u.uname, role: 'Viewer' }), tenant: JSON.stringify({ id: tenantId, subdomain: 'demo' }) });
  const page = await ctx.newPage();
  await page.goto(WEB + '/activity');
  await expect(page).toHaveURL(/\/dashboard$/);
  await ctx.close();
});

test('Cashier can read activity logs', async ({ request }) => {
  const u = await makeUser('Cashier');
  const res = await request.get(`${API}/activity-logs`, { headers: { Authorization: `Bearer ${u.token}` } });
  expect(res.status()).toBe(200);
});
