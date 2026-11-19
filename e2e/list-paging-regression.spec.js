// New regression tests for C4/C5 server-side paging and POS totals.
// No existing test is edited.
const { test, expect } = require('@playwright/test');
const { Client } = require('../backend/node_modules/pg');
const { testDatabaseUrl } = require('../backend/scripts/_guard');
const { API_URL } = require('../backend/scripts/e2e-ports');

const API = process.env.E2E_API_URL || API_URL;
const WEB = String(process.env.E2E_WEB_URL || API_URL).replace(/:5055\/api$/, ':4173');
let client;
let tenantId;
let prefix;
let seedCount;

async function loginState(browser) {
  let res;
  for (let i = 0; i < 30; i += 1) {
    try {
      res = await fetch(`${API}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'demo_admin', password: 'Demo1234!' }),
      });
      if (res.ok) break;
    } catch { /* backend not ready */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  const auth = await res.json();
  const ctx = await browser.newContext({ viewport: { width: 1344, height: 960 } });
  await ctx.addInitScript((s) => {
    localStorage.setItem('token', s.token);
    localStorage.setItem('user', s.user);
    localStorage.setItem('tenant', s.tenant);
  }, { token: auth.token, user: JSON.stringify(auth.user), tenant: JSON.stringify(auth.user.tenant || {}) });
  return ctx;
}

test.beforeAll(async () => {
  client = new Client({ connectionString: testDatabaseUrl() });
  await client.connect();
  tenantId = (await client.query("SELECT id FROM tenants WHERE subdomain='demo'")).rows[0].id;
  await client.query("DELETE FROM tbl_products WHERE barcode LIKE 'REG%'");
  await client.query("DELETE FROM tbl_categories WHERE name LIKE 'REG% Cat'");
  const base = (await client.query('SELECT COUNT(*)::int n FROM tbl_products WHERE tenant_id=$1', [tenantId])).rows[0].n;
  seedCount = 521 - base;
});

test.beforeEach(async () => {
  prefix = `REG${Date.now()}${Math.random().toString(16).slice(2, 6)}`;
});

test.afterEach(async () => { if (client) await cleanup(); });

test.afterAll(async () => { if (client) await client.end(); });

async function seed() {
  const cat = await client.query('INSERT INTO tbl_categories (name, tenant_id) VALUES ($1,$2) RETURNING id', [`${prefix} Cat`, tenantId]);
  const sup = await client.query('SELECT id FROM tbl_suppliers WHERE tenant_id=$1 LIMIT 1', [tenantId]);
  for (let i = 1; i <= seedCount; i += 1) {
    await client.query(
      `INSERT INTO tbl_products (name, barcode, category_id, supplier_id, price, cost, stock, tenant_id, status)
       VALUES ($1,$2,$3,$4,5,2,10,$5,'Active')`,
      [`${prefix} ${i}`, `${prefix}-${i}`, cat.rows[0].id, sup.rows[0].id, tenantId]
    );
  }
  return { categoryId: cat.rows[0].id, categoryName: `${prefix} Cat` };
}

async function cleanup() {
  await client.query('DELETE FROM tbl_products WHERE barcode LIKE $1', [`${prefix}-%`]);
  await client.query('DELETE FROM tbl_categories WHERE name=$1', [`${prefix} Cat`]);
}

test('Products page shows server total and page 2 has different rows', async ({ browser }) => {
  await seed();
  const ctx = await loginState(browser);
  const page = await ctx.newPage();
  await page.goto(WEB + '/products');
  await page.getByText(/of 521 results/).first().waitFor({ timeout: 15000 });
  await page.getByPlaceholder(/Search by name, barcode/).fill(prefix);
  await page.getByText(new RegExp(`of ${seedCount} results`)).first().waitFor({ timeout: 15000 });
  const namesOn = async () => [...(await page.locator('body').innerText()).matchAll(new RegExp(`${prefix} \\d+`, 'g'))].map((m) => m[0]);
  const page1Names = await namesOn();
  expect(page1Names.length).toBeGreaterThan(0);
  await page.getByRole('button', { name: '2', exact: true }).click();
  await page.getByText(new RegExp(`Showing 11 to 20 of ${seedCount} results`)).waitFor({ timeout: 15000 });
  const page2Names = await namesOn();
  expect(page2Names.some((n) => !page1Names.includes(n))).toBe(true);
  await ctx.close();
});

test('Reports product report shows 521 total and page control works', async ({ browser }) => {
  await seed();
  const ctx = await loginState(browser);
  const page = await ctx.newPage();
  await page.goto(WEB + '/reports');
  await page.locator('select').first().selectOption('products');
  await page.getByText('Total: 521 records').waitFor({ timeout: 15000 });
  expect(await page.locator('body').innerText()).toContain('Showing 20 of 521 records');
  await page.getByRole('button', { name: '2', exact: true }).click();
  await page.getByText(/Showing 21 to 40 of 521 results/).waitFor({ timeout: 15000 });
  await ctx.close();
});

test('Orders picker shows server total, Next and q search', async ({ browser }) => {
  await seed();
  const ctx = await loginState(browser);
  const page = await ctx.newPage();
  await page.goto(WEB + '/orders');
  await page.getByText(/Showing 50 of 521 products/).waitFor({ timeout: 15000 });
  expect(await page.locator('body').innerText()).toContain('Page 1 / 11');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByText('Page 2 / 11').waitFor({ timeout: 15000 });
  await page.getByPlaceholder(/Search products by name, barcode/).fill(`${prefix}-${seedCount}`);
  await page.getByText(/Showing 1 of 1 products/).waitFor({ timeout: 15000 });
  await ctx.close();
});

test('POS shows 200 of 521 and category chip count', async ({ browser }) => {
  const { categoryName } = await seed();
  const ctx = await loginState(browser);
  const page = await ctx.newPage();
  await page.goto(WEB + '/sell');
  await page.getByTestId('pos-product-total').waitFor({ timeout: 15000 });
  expect(await page.getByTestId('pos-product-total').innerText()).toBe('Showing 200 of 521 products');
  await page.getByRole('button', { name: categoryName }).click();
  await expect.poll(() => page.getByTestId('pos-product-total').innerText()).toBe(`Showing 200 of ${seedCount} products`);
  await ctx.close();
});
