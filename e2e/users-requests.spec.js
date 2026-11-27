// New checks for the /users double-fetch fix. No existing test is modified.
const { test, expect } = require('@playwright/test');

const { API_URL } = require('../backend/scripts/e2e-ports');
const API = process.env.E2E_API_URL || API_URL;
const ADMIN = { username: 'demo_admin', password: 'Demo1234!' };

async function loggedInPage(browser) {
  const login = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ADMIN.username, password: ADMIN.password }),
  });
  const auth = await login.json();
  const context = await browser.newContext({ viewport: { width: 1344, height: 960 } });
  await context.addInitScript((s) => {
    localStorage.setItem('token', s.token);
    localStorage.setItem('user', s.user);
    localStorage.setItem('tenant', s.tenant);
  }, {
    token: auth.token,
    user: JSON.stringify(auth.user),
    tenant: JSON.stringify(auth.user.tenant || {}),
  });
  return { context, page: await context.newPage() };
}

function isUsersRequest(url) {
  try {
    return new URL(url).pathname === '/api/users';
  } catch {
    return false;
  }
}

test('opening /users alone fetches the user list exactly once', async ({ browser }) => {
  const { context, page } = await loggedInPage(browser);
  let calls = 0;
  page.on('request', (req) => {
    if (req.method() === 'GET' && isUsersRequest(req.url())) calls += 1;
  });

  await page.goto('/users');
  await expect(page.getByPlaceholder(/Search by username, name, email/)).toBeVisible();
  await page.waitForTimeout(1500);

  expect(calls).toBe(1);
  await context.close();
});

test('clearing the user search restores the full list', async ({ browser }) => {
  const { context, page } = await loggedInPage(browser);
  const lengths = [];
  page.on('response', async (res) => {
    if (res.request().method() !== 'GET' || !isUsersRequest(res.url())) return;
    try {
      const body = await res.json();
      const rows = Array.isArray(body) ? body : (body.users || body.data || []);
      lengths.push(rows.length);
    } catch {
      // ignore non-JSON error bodies
    }
  });

  await page.goto('/users');
  await expect(page.getByPlaceholder(/Search by username, name, email/)).toBeVisible();
  await expect.poll(() => lengths.length).toBeGreaterThan(0);
  const initialLength = lengths[0];

  const search = page.getByPlaceholder(/Search by username, name, email/);
  await search.fill('demo_admin');
  await expect.poll(() => lengths.length).toBeGreaterThan(1);
  // The backend /users route currently ignores the search param, so the
  // response is still the full list; what matters here is that the debounce
  // fires after typing (not on mount) and does not change the data shape.
  expect(lengths[lengths.length - 1]).toBe(initialLength);

  await search.fill('');
  await expect.poll(() => lengths.length).toBeGreaterThan(2);
  // Clearing must also fetch and return the whole list again.
  expect(lengths[lengths.length - 1]).toBe(initialLength);
  await context.close();
});
