// e2e/route-smoke.spec.js
//
// Visits every concrete frontend route and fails on any pageerror, console
// error, or failed (4xx/5xx) API response. Known, explained exceptions live in
// ALLOWLIST below — every entry needs a route, an API path/status or a console
// substring, and a written reason. Adding an entry is a deliberate, reviewed
// act; the rule itself is never disabled.
const { test, expect } = require('@playwright/test');

const { API_URL } = require('../backend/scripts/e2e-ports');

const API = process.env.E2E_API_URL || API_URL;
const API_ORIGIN = API.replace(/\/api\/?$/, '');
const ADMIN = { username: 'demo_admin', password: 'Demo1234!' };
const ROOT = { username: 'demo_root', password: 'Demo1234!' };

// Routes grouped by the session that may visit them.
const PUBLIC_ROUTES = [
  '/', '/login', '/register', '/pricing', '/help',
];
const TENANT_ROUTES = [
  '/dashboard', '/orders', '/sell', '/online-orders',
  '/products', '/customers', '/stock', '/suppliers',
  '/reports', '/users', '/activity', '/warranty', '/analytics',
  '/profile', '/settings', '/change-password',
];
const SUPERADMIN_ROUTES = [
  '/admin', '/admin/tenants', '/admin/users',
];

// Documented exceptions. Keep this list empty unless a failure is understood
// and explained here; an unexplained entry is a test weakening.
const ALLOWLIST = [];

function apiPathOf(url) {
  try {
    const u = new URL(url);
    return u.origin === API_ORIGIN ? u.pathname : null;
  } catch {
    return null;
  }
}

function allowedApi(route, path, status) {
  return ALLOWLIST.some(entry =>
    entry.route === route && entry.apiPath === path && entry.statuses.includes(status));
}

async function login(page, user) {
  await page.goto('/login');
  await page.locator('input[name="username"]').fill(user.username);
  await page.locator('input[name="password"]').fill(user.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForFunction(() => !!localStorage.getItem('token') && !!localStorage.getItem('user'));
  await expect(page).not.toHaveURL(/\/login$/);
}

async function visitRoute(context, route, allow) {
  const page = await context.newPage();
  const problems = [];
  let allowedApiCount = 0;

  page.on('pageerror', (err) => problems.push(`pageerror: ${String(err).split('\n')[0]}`));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    // A failed API response also emits a generic "Failed to load resource"
    // console error. Pair it with an allowed API failure instead of silencing
    // console errors wholesale.
    if (/Failed to load resource/.test(text) && allowedApiCount > 0) {
      allowedApiCount -= 1;
      return;
    }
    problems.push(`console: ${text.slice(0, 180)}`);
  });
  page.on('response', (res) => {
    if (res.status() < 400) return;
    const path = apiPathOf(res.url());
    if (!path) return; // third-party responses are out of scope
    if (allowedApi(route, path, res.status())) {
      allowedApiCount += 1;
      return;
    }
    problems.push(`api: ${res.status()} ${path}`);
  });

  await page.goto(route, { waitUntil: 'domcontentloaded' });
  // Wait for the app shell to mount, then let in-flight requests settle:
  // wait for network idle, not a fixed sleep.
  await page.waitForSelector('h1, h2, [role=main]', { timeout: 20000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});

  const problemsForRoute = problems.slice();
  await page.close();
  expect(problemsForRoute, `${route}: ${problemsForRoute.join(' | ')}`).toEqual([]);
}

test.describe('route smoke — no console errors, pageerrors or failed API calls', () => {
  test('public routes', async ({ browser }) => {
    const context = await browser.newContext();
    for (const route of PUBLIC_ROUTES) await visitRoute(context, route, ALLOWLIST);
    await context.close();
  });

  test('tenant routes', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, ADMIN);
    await page.close();
    for (const route of TENANT_ROUTES) await visitRoute(context, route, ALLOWLIST);
    await context.close();
  });

  test('super-admin routes', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, ROOT);
    await page.close();
    for (const route of SUPERADMIN_ROUTES) await visitRoute(context, route, ALLOWLIST);
    await context.close();
  });
});
