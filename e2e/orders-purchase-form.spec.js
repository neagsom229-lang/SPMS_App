// e2e/orders-purchase-form.spec.js
//
// Orders purchase form: a valid purchase persists to the DB and decreases
// stock; an invalid purchase shows the server's field-specific error, keeps
// the form open, and saves nothing. Existing assertions must not be weakened.
const { test, expect } = require('@playwright/test');
const { Client } = require('../backend/node_modules/pg');
const { testDatabaseUrl } = require('../backend/scripts/_guard');
const { API_URL } = require('../backend/scripts/e2e-ports');

const API = process.env.E2E_API_URL || API_URL;
const ADMIN = { username: 'demo_admin', password: 'Demo1234!' };

let client;

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
  const res = await page.request.get(`${API}${path}`, { headers, maxRetries: 3 });
  expect(res.ok(), `GET ${path} -> ${res.status()}`).toBeTruthy();
  return res.json();
}

test.beforeAll(async () => {
  client = new Client({ connectionString: testDatabaseUrl() });
  await client.connect();
});

test.afterAll(async () => {
  if (client) await client.end().catch(() => {});
});

test('Orders purchase form: valid purchase persists to DB and decreases stock', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[name="username"]').fill(ADMIN.username);
  await page.locator('input[name="password"]').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  const welcome = page.getByRole('button', { name: 'Enter Control Center' });
  if (await welcome.isVisible().catch(() => false)) await welcome.click();

  await page.goto('/orders');
  await expect(page.getByRole('heading', { name: /Orders Management/i })).toBeVisible();

  // Ensure create mode and add an item row.
  const addItemBtn = page.locator('.orders-items-add-btn');
  await expect(addItemBtn).toBeVisible();
  if (await page.locator('.orders-items-tr').count() === 0) {
    await addItemBtn.click();
  }

  // Select first real customer.
  const customerSelect = page.locator('.orders-customer-select');
  await expect(customerSelect).toBeVisible();
  await expect.poll(async () => customerSelect.locator('option').count()).toBeGreaterThan(1);
  const customerValue = await customerSelect.locator('option').nth(1).getAttribute('value');
  await customerSelect.selectOption(customerValue);

  // Select first in-stock product in the first item row.
  const productSelect = page.locator('.orders-items-product-select').first();
  await expect(productSelect).toBeVisible();
  await expect.poll(async () => productSelect.locator('option').count()).toBeGreaterThan(1);
  const productOption = productSelect.locator('option').filter({ hasNotText: /Out of stock/i }).nth(1);
  await expect(productOption).toHaveCount(1);
  const productId = Number(await productOption.getAttribute('value'));
  expect(Number.isFinite(productId) && productId > 0).toBeTruthy();
  await productSelect.selectOption(String(productId));

  // Read stock before purchase from the server.
  const stockBeforeRows = await apiGet(page, '/stock');
  const stockBeforeRow = stockBeforeRows.find(r => Number(r.productid) === productId);
  expect(stockBeforeRow, 'stock row exists before purchase').toBeTruthy();
  const qtyBefore = Number(stockBeforeRow.qtyavailable ?? stockBeforeRow.qtyinstock);

  const ordersBefore = (await client.query('SELECT COUNT(*)::int AS n FROM tbl_orders')).rows[0].n;

  await page.locator('.orders-actions-purchase').click();
  await expect(page.getByText(/Purchase completed!/i)).toBeVisible({ timeout: 20000 });

  // DB: a new order row exists and stock decreased by the purchased quantity (1).
  await expect.poll(async () => {
    const n = (await client.query('SELECT COUNT(*)::int AS n FROM tbl_orders')).rows[0].n;
    return n;
  }, { timeout: 10000 }).toBeGreaterThan(ordersBefore);

  await expect.poll(async () => {
    const rows = await apiGet(page, '/stock');
    const row = rows.find(r => Number(r.productid) === productId);
    return row ? Number(row.qtyavailable ?? row.qtyinstock) : -1;
  }, { timeout: 10000 }).toBe(qtyBefore - 1);
});

test('Orders purchase form: invalid purchase shows field-specific error, keeps form open, saves nothing', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[name="username"]').fill(ADMIN.username);
  await page.locator('input[name="password"]').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  const welcome = page.getByRole('button', { name: 'Enter Control Center' });
  if (await welcome.isVisible().catch(() => false)) await welcome.click();

  const ordersBefore = (await client.query('SELECT COUNT(*)::int AS n FROM tbl_orders')).rows[0].n;

  await page.goto('/orders');
  await expect(page.getByRole('heading', { name: /Orders Management/i })).toBeVisible();

  const addItemBtn = page.locator('.orders-items-add-btn');
  await expect(addItemBtn).toBeVisible();
  if (await page.locator('.orders-items-tr').count() === 0) {
    await addItemBtn.click();
  }

  const customerSelect = page.locator('.orders-customer-select');
  await expect.poll(async () => customerSelect.locator('option').count()).toBeGreaterThan(1);
  await customerSelect.selectOption(await customerSelect.locator('option').nth(1).getAttribute('value'));

  const productSelect = page.locator('.orders-items-product-select').first();
  await expect.poll(async () => productSelect.locator('option').count()).toBeGreaterThan(1);
  const productOption = productSelect.locator('option').filter({ hasNotText: /Out of stock/i }).nth(1);
  await productSelect.selectOption(await productOption.getAttribute('value'));

  // Make discount invalid (greater than subtotal) to trigger a field-specific 400.
  const discountInput = page.locator('.orders-summary-discount-input');
  await expect(discountInput).toBeVisible();
  await discountInput.fill('9999999');

  await page.locator('.orders-actions-purchase').click();

  await expect(page.getByText(/discount must be between 0 and the order subtotal/i)).toBeVisible({ timeout: 20000 });

  // Form stays open with the user's selection intact and nothing is saved.
  await expect(page).toHaveURL(/\/orders/);
  await expect(page.locator('.orders-items-tr')).toHaveCount(1);
  await expect(customerSelect).not.toHaveValue('');

  const ordersAfter = (await client.query('SELECT COUNT(*)::int AS n FROM tbl_orders')).rows[0].n;
  expect(ordersAfter).toBe(ordersBefore);
});
