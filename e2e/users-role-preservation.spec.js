// New test: editing a Staff user must show and preserve the real role.
// No existing test is edited.
const { test, expect } = require('@playwright/test');
const { Client } = require('../backend/node_modules/pg');
const bcrypt = require('../backend/node_modules/bcryptjs');
const { testDatabaseUrl } = require('../backend/scripts/_guard');
const { API_URL } = require('../backend/scripts/e2e-ports');

const API = process.env.E2E_API_URL || API_URL;
const SUFFIX = String(Date.now());
let client;
let username;

async function loginState() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'demo_admin', password: 'Demo1234!' }),
  });
  const auth = await res.json();
  return { token: auth.token, user: JSON.stringify(auth.user), tenant: JSON.stringify(auth.user.tenant || {}) };
}

test.beforeAll(async () => {
  const url = testDatabaseUrl();
  const parsed = new URL(url);
  if (parsed.port !== '15432' || !parsed.pathname.endsWith('_test')) {
    throw new Error(`refusing to run: DB target is ${parsed.hostname}:${parsed.port}${parsed.pathname}`);
  }
  client = new Client({ connectionString: url });
  await client.connect();
  const t = await client.query("SELECT id FROM tenants WHERE subdomain='demo'");
  username = `rolekeep_${SUFFIX}`;
  await client.query(
    `INSERT INTO tbl_users (username,email,password,fullname,role,status,tenant_id,must_change_password)
     VALUES ($1,$2,$3,'Role Keep','Staff','ACTIVE',$4,FALSE)`,
    [username, `${username}@e2e.test`, bcrypt.hashSync('Test1234!', 10), t.rows[0].id]
  );
});

test.afterAll(async () => {
  if (!client) return;
  await client.query("DELETE FROM tbl_users WHERE username LIKE 'rolekeep_%'");
  await client.end();
});

test('editing an unrelated field keeps the Staff role', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1344, height: 960 } });
  await context.addInitScript((s) => {
    localStorage.setItem('token', s.token);
    localStorage.setItem('user', s.user);
    localStorage.setItem('tenant', s.tenant);
  }, await loginState());
  const page = await context.newPage();
  const statuses = [];
  page.on('response', (res) => {
    if (res.request().method() === 'PUT' && /\/api\/users\//.test(new URL(res.url()).pathname)) statuses.push(res.status());
  });

  await page.goto('/users');
  await page.getByText(username, { exact: true }).first().waitFor({ timeout: 15000 });
  await page.getByTitle('List view').click();
  await page.locator('tbody tr').filter({ hasText: username }).getByTitle('Edit').first().click();

  const roleSelect = page.locator('select').filter({ has: page.locator('option[value="Staff"]') });
  await expect(roleSelect).toHaveValue('Staff');

  await page.getByPlaceholder('Enter phone').fill(`09${SUFFIX}`);
  await page.getByPlaceholder('Enter full name').fill('Role Keep Edited');
  await page.getByRole('button', { name: 'Update User' }).click();
  await expect.poll(() => statuses.length).toBeGreaterThan(0);
  expect(statuses[statuses.length - 1]).toBe(200);

  const after = await client.query('SELECT role, fullname FROM tbl_users WHERE username=$1', [username]);
  expect(after.rows[0].role).toBe('Staff');
  expect(after.rows[0].fullname).toBe('Role Keep Edited');
  await context.close();
});
