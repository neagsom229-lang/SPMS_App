// e2e/golden-path.spec.js
//
// The one end-to-end path that must always work:
//   login -> create a product -> receive stock -> sell in POS -> order in Orders
//   -> stock decreased -> dashboard revenue changed.
//
// Product creation must leave a tbl_stock row behind on the server. The very
// first assertion after saving the product reads GET /api/stock; if the server
// stopped inserting that row (the old client-side call is gone), this test
// fails before any later step can hide it.
const { test, expect } = require('@playwright/test');

const { API_URL } = require('../backend/scripts/e2e-ports');

const API = process.env.E2E_API_URL || API_URL;

const ADMIN = { username: 'demo_admin', password: 'Demo1234!' };
// seeded by backend/scripts/seed-demo.js with must_change_password = TRUE
const FORCED = { username: 'demo_forced', password: 'Demo1234!', nextPassword: 'NewPass123!' };
const PRICE = 12.34;
const SELL_QTY = 2;
const RECEIVED_QTY = 15;
const EXPECTED_QTY = RECEIVED_QTY - SELL_QTY;
const STAMP = Date.now();
const NAME = `E2E Golden ${STAMP}`;
const BARCODE = `E2E-${STAMP}`;

async function authHeaders(page) {
  const state = await page.evaluate(() => ({
    token: localStorage.getItem('token'),
    tenant: JSON.parse(localStorage.getItem('tenant') || '{}'),
  }));
  const headers = { Authorization: `Bearer ${state.token}` };
  if (state.tenant.id) {
    headers['x-tenant-id'] = String(state.tenant.id);
    headers['x-tenant-subdomain'] = String(state.tenant.subdomain || '');
  }
  return headers;
}

async function apiGet(page, path) {
  const headers = await authHeaders(page);
  const res = await page.request.get(`${API}${path}`, { headers });
  expect(res.ok(), `GET ${path} -> ${res.status()}`).toBeTruthy();
  return res.json();
}

async function findStockRow(page, productId) {
  const rows = await apiGet(page, '/stock');
  return rows.find(row => Number(row.productid) === Number(productId));
}

test('golden path: product -> stock -> sale -> order -> dashboard', async ({ page }) => {
  // 1. Login.
  await page.goto('/login');
  await page.locator('input[name="username"]').fill(ADMIN.username);
  await page.locator('input[name="password"]').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  const welcome = page.getByRole('button', { name: 'Enter Control Center' });
  if (await welcome.isVisible().catch(() => false)) await welcome.click();

  // 2. Dashboard revenue before the sale.
  const before = await apiGet(page, '/dashboard/stats');
  const revenueBefore = Number(before.totalRevenue);

  // 3. Create a product (initial stock 0) through the real UI.
  await page.goto('/products');
  await expect(page.getByRole('heading', { name: /Products Inventory/ })).toBeVisible();
  await page.getByRole('button', { name: 'Add Product' }).click();
  await page.locator('input[placeholder="Enter product name in English"]').fill(NAME);
  await page.locator('input[placeholder="Enter barcode"]').fill(BARCODE);
  await page.locator('form input[type="number"][required]').fill(PRICE.toFixed(2));
  const initialStock = page.locator('div.group').filter({ hasText: 'Initial Stock' }).locator('input');
  await initialStock.fill('0');
  await page.getByRole('button', { name: 'Save Product' }).click();

  // The product row must exist now, with a server-created stock row of 0.
  let product;
  await expect
    .poll(async () => {
      const body = await apiGet(page, '/products?limit=200');
      product = (body.products || []).find(p => p.barcode === BARCODE);
      return !!product;
    }, { message: 'the created product appears in GET /api/products' })
    .toBe(true);

  const createdStock = await findStockRow(page, product.id);
  expect(createdStock, 'product creation must insert a tbl_stock row server-side').toBeTruthy();
  expect(Number(createdStock.qtyavailable)).toBe(0);

  // 4. Receive stock through the Stock page (set exact values to 15).
  await page.goto('/stock');
  await page.locator('input[placeholder="🔍 Search by name, ID..."]').fill(NAME);
  await page.getByTitle('Edit stock').first().click();
  await page.locator('.stock-form-select').selectOption('set');
  await page.locator('.stock-form-input').nth(1).fill(String(RECEIVED_QTY));
  await page.getByRole('button', { name: /Update Stock/ }).click();

  await expect
    .poll(async () => {
      const row = await findStockRow(page, product.id);
      return row ? Number(row.qtyavailable) : -1;
    }, { message: 'stock reaches 15 after the Stock page update' })
    .toBe(RECEIVED_QTY);

  // 5. Sell two units in the POS screen.
  await page.goto('/sell');
  await page.locator('input[placeholder="Scan barcode or search products..."]').fill(NAME);
  const card = page.locator('div.cursor-pointer').filter({ hasText: NAME }).first();
  await card.click();
  await card.click();
  const saleTotal = (PRICE * SELL_QTY).toFixed(2);
  await page.getByRole('button', { name: `Proceed to Payment ($${saleTotal})` }).click();
  await page.locator(`input[type="number"][placeholder="${saleTotal}"]`).fill('100');
  await page.getByRole('button', { name: `Confirm Sale ($${saleTotal})` }).click();

  await expect(page.getByText('Sale Completed!')).toBeVisible();
  const receiptText = await page.getByText(/Order #/).first().textContent();
  const orderNo = (receiptText.match(/Order #(\S+)/) || [])[1];
  expect(orderNo, `receipt order number (${receiptText})`).toBeTruthy();
  await page.getByRole('button', { name: 'New Sale' }).click();

  // 6. The order is listed in Orders.
  await page.goto('/orders');
  await page.locator('.orders-mode-btn').filter({ hasText: 'Orders' }).click();
  await expect(page.locator('table')).toContainText(orderNo);

  // 7. Stock decreased by the quantity sold.
  await expect
    .poll(async () => {
      const row = await findStockRow(page, product.id);
      return row ? Number(row.qtyavailable) : -1;
    }, { message: `stock decreases from ${RECEIVED_QTY} to ${EXPECTED_QTY}` })
    .toBe(EXPECTED_QTY);

  // 8. Dashboard revenue changed by the sale total.
  await page.goto('/dashboard');
  await expect
    .poll(async () => Number((await apiGet(page, '/dashboard/stats')).totalRevenue))
    .toBeCloseTo(revenueBefore + PRICE * SELL_QTY, 2);

  // 9. Both dashboard charts draw more than zero elements for the seeded data.
  //    The trend chart draws one area <path> plus a revenue <rect> per month
  //    and an orders <circle> per month; the sales-mix donut draws one arc
  //    <path> per category.
  const trend = page.locator('svg[aria-label="Revenue and orders, trailing 6 months"]');
  await expect(trend).toBeVisible();
  await expect
    .poll(async () => trend.locator('path').count(), { message: 'trend chart area path' })
    .toBeGreaterThan(0);
  await expect
    .poll(async () => trend.locator('rect').count(), { message: 'trend chart month bars' })
    .toBeGreaterThan(0);
  await expect
    .poll(async () => trend.locator('circle[data-value]').count(), { message: 'trend chart order points' })
    .toBeGreaterThan(0);

  // The current month is the last bucket. Its bar is the tenant's monthly
  // revenue from /dashboard/analytics-summary, so after this sale it must be
  // exactly the pre-sale revenue plus this sale's total.
  await expect
    .poll(
      async () => Number(await trend.locator('rect[data-value]').last().getAttribute('data-value')),
      { message: `current-month revenue bar = ${revenueBefore} + ${PRICE * SELL_QTY}` }
    )
    .toBeCloseTo(revenueBefore + PRICE * SELL_QTY, 2);

  const donut = page.locator('svg[aria-label="Sales mix by category"]');
  await expect(donut).toBeVisible();
  await expect
    .poll(async () => donut.locator('path').count(), { message: 'sales mix donut arc paths' })
    .toBeGreaterThan(0);
  await expect
    .poll(
      async () => donut.locator('path[data-value]').evaluateAll(
        nodes => nodes.filter(node => Number(node.getAttribute('data-value')) > 0).length
      ),
      { message: 'sales mix has at least one positive category segment' }
    )
    .toBeGreaterThan(0);

  // The product created above has no category, so its sale lands in the
  // "Uncategorized" segment; that segment must cover at least this sale.
  await expect
    .poll(
      async () => donut.locator('path[data-name="Uncategorized"]').evaluateAll(
        nodes => nodes.reduce((sum, node) => sum + Number(node.getAttribute('data-value') || 0), 0)
      ),
      { message: 'seeded sale appears in the sales mix' }
    )
    .toBeGreaterThanOrEqual(PRICE * SELL_QTY);
});

test('fresh tenant dashboard shows the empty state', async ({ page }) => {
  const stamp = Date.now();
  const subdomain = `e2eempty${stamp}`;
  const password = 'Qa!123456';

  const registered = await page.request.post(`${API}/auth/register-client`, {
    data: {
      businessName: 'E2E Empty Tenant',
      email: `${subdomain}@test.com`,
      password,
      subdomain,
    },
  });
  expect(registered.ok(), `register-client -> ${registered.status()}`).toBeTruthy();

  await page.goto('/login');
  await page.locator('input[name="username"]').fill(`${subdomain}_admin`);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole('button', { name: 'Enter Control Center' }).click();

  await expect(page.getByText('No sales yet').first()).toBeVisible();
});

test('forced password change: blocked until a new password is set', async ({ page }) => {
  // 1. A user with must_change_password = TRUE lands on /change-password.
  await page.goto('/login');
  await page.locator('input[name="username"]').fill(FORCED.username);
  await page.locator('input[name="password"]').fill(FORCED.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/change-password/);

  // 2. The rest of the app is unusable: every API call comes back
  //    PASSWORD_CHANGE_REQUIRED and the client bounces back here.
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/change-password/);

  // 3. Changing the password releases the account.
  await page.locator('input[name="oldPassword"]').fill(FORCED.password);
  await page.locator('input[name="newPassword"]').fill(FORCED.nextPassword);
  await page.locator('input[name="confirmPassword"]').fill(FORCED.nextPassword);
  await page.getByRole('button', { name: 'Change Password' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  const trend = page.locator('svg[aria-label="Revenue and orders, trailing 6 months"]');
  await expect(trend).toBeVisible();

  // 4. The new password really is the one stored on the server.
  const relogin = await page.request.post(`${API}/auth/login`, {
    data: { username: FORCED.username, password: FORCED.nextPassword },
  });
  expect(relogin.ok(), `login with the new password -> ${relogin.status()}`).toBeTruthy();

  const wrongOld = await page.request.post(`${API}/auth/login`, {
    data: { username: FORCED.username, password: FORCED.password },
  });
  expect(wrongOld.ok(), 'the temporary password must stop working').toBeFalsy();
});
