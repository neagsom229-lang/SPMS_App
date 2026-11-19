// Tests for admin-only Dashboard sales-summary gating. New file only.
const { test, expect } = require('@playwright/test');
const { Client } = require('../backend/node_modules/pg');
const bcrypt = require('../backend/node_modules/bcryptjs');
const { testDatabaseUrl } = require('../backend/scripts/_guard');

const USERS = {
  Admin: { username: 'demo_admin', password: 'Demo1234!' },
  Staff: { username: 'demo_staff', password: 'Demo1234!' },
  Viewer: { username: '', password: 'Demo1234!' },
};

let client;
const STAMP = String(Date.now());

test.beforeAll(async () => {
  const url = testDatabaseUrl();
  const parsed = new URL(url);
  if (parsed.port !== '15432' || !parsed.pathname.endsWith('_test')) {
    throw new Error(`refusing to run: DB target is ${parsed.hostname}:${parsed.port}${parsed.pathname}`);
  }
  client = new Client({ connectionString: url });
  await client.connect();
  const tenant = await client.query("SELECT id FROM tenants WHERE subdomain='demo'");
  const username = `gate_viewer_${STAMP}`;
  await client.query(
    `INSERT INTO tbl_users (username,email,password,fullname,role,status,tenant_id,must_change_password)
     VALUES ($1,$2,$3,'Gate Viewer','Viewer','ACTIVE',$4,FALSE)`,
    [username, `${username}@e2e.test`, bcrypt.hashSync(USERS.Viewer.password, 10), tenant.rows[0].id]
  );
  USERS.Viewer.username = username;
});

test.afterAll(async () => {
  if (!client) return;
  await client.query("DELETE FROM tbl_users WHERE username LIKE 'gate_viewer_%'");
  await client.end();
});

async function login(page, user) {
  await page.goto('/login');
  await page.locator('input[name="username"]').fill(user.username);
  await page.locator('input[name="password"]').fill(user.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function expectNoSummaryRequests(page, role) {
  const calls = [];
  page.on('request', (req) => {
    if (new URL(req.url()).pathname === '/api/dashboard/sales-summary') calls.push(req.method());
  });
  await login(page, USERS[role]);
  await page.waitForTimeout(2000);
  expect(calls, `${role} must not call /api/dashboard/sales-summary`).toEqual([]);

  // The dashboard opens a first-login welcome modal and a toast, both of which
  // sit above the header and intercept a normal click on Refresh. Dismiss them
  // so the click exercises the app, not the overlay.
  await page.getByRole('button', { name: 'Enter Control Center' }).click();
  await expect(page.locator('[data-rht-toaster] [role="status"]')).toHaveCount(0, { timeout: 10000 });

  await page.getByRole('button', { name: 'Refresh' }).click();
  await page.waitForTimeout(2000);
  expect(calls, `${role} must not call sales-summary after Refresh`).toEqual([]);
  await expect(page.getByText('Admin only')).toBeVisible();
}

test('Staff dashboard does not request admin-only sales-summary', async ({ page }) => {
  await expectNoSummaryRequests(page, 'Staff');
});

test('Viewer dashboard does not request admin-only sales-summary', async ({ page }) => {
  await expectNoSummaryRequests(page, 'Viewer');
});

test('Admin dashboard requests sales-summary and shows the widget', async ({ page }) => {
  const statuses = [];
  page.on('response', (res) => {
    if (new URL(res.url()).pathname === '/api/dashboard/sales-summary') statuses.push(res.status());
  });
  await login(page, USERS.Admin);
  await page.waitForTimeout(2500);
  expect(statuses.length).toBeGreaterThan(0);
  expect(statuses).toContain(200);
  await expect(page.locator('svg[aria-label="Revenue and orders, trailing 6 months"]')).toBeVisible();
});
