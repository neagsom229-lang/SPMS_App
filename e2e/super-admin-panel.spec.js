// e2e/super-admin-panel.spec.js
//
// Phase 9e: the super-admin Businesses page shows a "Pending Payment
// Sessions" panel. Both halves of the contract:
//   1. the owner can settle a PENDING session by hand, and the tenant's plan
//      and plan_expires_at really change on the server;
//   2. a tenant admin and a staff user can reach neither the panel nor its
//      API (SuperAdminRoute redirect + requireSuperAdmin 403).
//
// The session is seeded through POST /api/payment/bakong/create-qr, the same
// public path a tenant uses to buy a subscription. No SQL anywhere here.
const { test, expect } = require('@playwright/test');

const { API_URL } = require('../backend/scripts/e2e-ports');

const API = process.env.E2E_API_URL || API_URL;

const ADMIN = { username: 'demo_admin', password: 'Demo1234!' };
const STAFF = { username: 'demo_staff', password: 'Demo1234!' };
const ROOT = { username: 'demo_root', password: 'Demo1234!' };
const REASON = 'e2e manual settlement';

async function login(page, user) {
  await page.goto('/login');
  await page.locator('input[name="username"]').fill(user.username);
  await page.locator('input[name="password"]').fill(user.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  // The login POST is async. Wait until the SPA has actually stored the session
  // and navigated away from /login before the caller does page.goto(). Without
  // this, page.goto() aborts the in-flight request; the rehydrating AuthProvider
  // then finds an empty localStorage and bounces back to /login.
  await page.waitForFunction(() => !!localStorage.getItem('token') && !!localStorage.getItem('user'));
  await expect(page).not.toHaveURL(/\/login$/);
}

async function apiLogin(page, user) {
  const res = await page.request.post(`${API}/auth/login`, {
    data: { username: user.username, password: user.password },
  });
  expect(res.ok(), `login ${user.username} -> ${res.status()}`).toBeTruthy();
  return (await res.json()).token;
}

async function headers(token) {
  return { Authorization: `Bearer ${token}` };
}

// The seeded demo tenant, read straight from GET /api/tenants (t.* carries
// plan and plan_expires_at).
async function demoTenant(page, token) {
  const res = await page.request.get(`${API}/tenants?search=demo&limit=20`, {
    headers: await headers(token),
  });
  expect(res.ok(), `GET /tenants -> ${res.status()}`).toBeTruthy();
  const body = await res.json();
  return (body.tenants || []).find((t) => t.subdomain === 'demo');
}

test('super admin marks a pending session paid and the tenant plan is applied', async ({ page }) => {
  // 1. Seed a PENDING subscription session through the real API (no SQL).
  const tenantToken = await apiLogin(page, ADMIN);
  const qr = await page.request.post(`${API}/payment/bakong/create-qr`, {
    headers: await headers(tenantToken),
    data: { plan: 'chain', period_months: 1, currency: 'USD' },
  });
  expect(qr.ok(), `create-qr -> ${qr.status()}`).toBeTruthy();
  const qrBody = await qr.json();
  expect(qrBody.amount).toBe(49);

  // 2. The owner opens the panel and sees exactly that one pending session.
  await login(page, ROOT);
  await page.goto('/admin/tenants');
  await expect(page.getByRole('main').getByRole('heading', { name: 'Businesses' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pending Payment Sessions' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark Paid' })).toHaveCount(1);

  // 3. Before: the demo tenant is still on its seeded plan with no expiry.
  const before = await demoTenant(page, await apiLogin(page, ROOT));
  expect(before.plan).toBe('shophouse');
  expect(before.plan_expires_at).toBeNull();

  // 4. Mark paid; the panel asks for a reason through window.prompt.
  page.on('dialog', (dialog) => dialog.accept(REASON));
  await page.getByRole('button', { name: 'Mark Paid' }).click();

  // 5. The row is gone from the panel.
  await expect(page.getByText('No pending payment sessions')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark Paid' })).toHaveCount(0);

  // 6. The tenant's plan really changed on the server.
  const after = await demoTenant(page, await apiLogin(page, ROOT));
  expect(after.plan).toBe('chain');
  expect(after.plan_expires_at, 'plan_expires_at is set').toBeTruthy();
  expect(new Date(after.plan_expires_at).getTime()).toBeGreaterThan(Date.now());
});

test('tenant admin and staff can reach neither the panel nor its API', async ({ page }) => {
  const users = [ADMIN, STAFF];

  for (const user of users) {
    await login(page, user);
    await page.goto('/admin/tenants');

    // SuperAdminRoute bounces non-super-admins to the dashboard.
    await expect(page, `${user.username} redirected off /admin/tenants`).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: 'Pending Payment Sessions' })).toHaveCount(0);

    // The API behind the panel refuses them too.
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const res = await page.request.get(`${API}/payment/admin/sessions?status=PENDING`, {
      headers: await headers(token),
    });
    expect(res.status(), `${user.username} GET /payment/admin/sessions`).toBe(403);

    await page.evaluate(() => localStorage.clear());
  }
});
