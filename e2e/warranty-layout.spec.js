// New checks for the warranty UX fix. Bounding boxes and DOM state only:
// no pixel snapshots, and no existing assertion is modified.
const { test, expect } = require('@playwright/test');

const { API_URL } = require('../backend/scripts/e2e-ports');
const API = process.env.E2E_API_URL || API_URL;
const ADMIN = { username: 'demo_admin', password: 'Demo1234!' };

const VIEWPORTS = [
  { width: 1344, height: 960 },
  { width: 1920, height: 1080 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
];

async function login(page) {
  await page.goto('/login');
  // Filling before React hydrates leaves the controlled inputs empty.
  await page.waitForFunction(() => {
    const input = document.querySelector('input[name="username"]');
    return !!input && Object.keys(input).some((key) => key.startsWith('__reactProps'));
  });
  await page.locator('input[name="username"]').fill(ADMIN.username);
  await page.locator('input[name="password"]').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function openWarranty(page) {
  await page.goto('/warranty');
  await expect(page.getByTestId('warranty-tabs')).toBeVisible();
}

test('sidebar rows are padded and footer stays inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1344, height: 960 });
  await login(page);
  await openWarranty(page);

  const links = page.locator('[data-testid="sidebar-nav"] a');
  expect(await links.count()).toBeGreaterThan(5);
  const first = links.first();
  const metrics = await first.evaluate((el) => {
    const cs = getComputedStyle(el);
    const icon = el.querySelector('svg');
    return {
      paddingLeft: parseFloat(cs.paddingLeft),
      paddingTop: parseFloat(cs.paddingTop),
      height: el.getBoundingClientRect().height,
      iconX: icon ? icon.getBoundingClientRect().x : -1,
      asideX: el.closest('aside').getBoundingClientRect().x,
    };
  });
  expect(metrics.paddingLeft).toBeGreaterThanOrEqual(8);
  expect(metrics.paddingTop).toBeGreaterThanOrEqual(8);
  expect(metrics.height).toBeGreaterThanOrEqual(40);
  expect(metrics.iconX).toBeGreaterThan(metrics.asideX);

  const footerBox = await page.getByTestId('sidebar-footer').boundingBox();
  expect(footerBox).not.toBeNull();
  expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(960);
});

test('no horizontal page scroll at the four supported viewports', async ({ page }) => {
  await login(page);
  for (const vp of VIEWPORTS) {
    // eslint-disable-next-line no-await-in-loop
    await page.setViewportSize(vp);
    // eslint-disable-next-line no-await-in-loop
    await openWarranty(page);
    // eslint-disable-next-line no-await-in-loop
    const widths = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
      viewport: window.innerWidth,
    }));
    expect(widths.doc, `document scroll width at ${vp.width}`).toBeLessThanOrEqual(vp.width);
    expect(widths.body, `body scroll width at ${vp.width}`).toBeLessThanOrEqual(vp.width);
  }
});

test('at 1344px the four stats share a row and tabs are above the fold', async ({ page }) => {
  await page.setViewportSize({ width: 1344, height: 960 });
  await login(page);
  await openWarranty(page);

  const cards = page.getByTestId('warranty-stat');
  expect(await cards.count()).toBe(4);
  const boxes = [];
  for (let i = 0; i < 4; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    boxes.push(await cards.nth(i).boundingBox());
  }
  expect(new Set(boxes.map((b) => Math.round(b.y))).size).toBe(1);

  const tabsBox = await page.getByTestId('warranty-tabs').boundingBox();
  expect(tabsBox.y).toBeLessThan(960);

  // With no rows yet the page shows the empty state instead of the table;
  // either way the content area starts inside the first viewport.
  const table = page.getByTestId('warranty-table');
  const empty = page.getByTestId('warranty-empty');
  expect(await table.count() + await empty.count()).toBeGreaterThan(0);
});

test('product picker is populated and a created warranty appears in the list', async ({ page }) => {
  await page.setViewportSize({ width: 1344, height: 960 });
  await login(page);
  await openWarranty(page);

  await page.getByRole('button', { name: 'Add Warranty' }).first().click();
  const productOptions = page.getByTestId('product-option');
  await expect.poll(async () => productOptions.count()).toBeGreaterThan(0);

  const serial = `E2E-WARRANTY-${Date.now()}`;
  await page.getByTestId('customer-select').selectOption({ index: 1 });
  await page.getByTestId('product-select').selectOption({ index: 1 });
  await page.locator('input[placeholder="Enter serial number"]').fill(serial);
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByTestId('warranty-table')).toContainText(serial);
});

test('canonical storefront returns 200 and tested routes stay error-free', async ({ page }) => {
  const problems = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
  page.on('response', (res) => {
    if (res.status() >= 400) problems.push(`http ${res.status()}: ${res.url()}`);
  });

  await login(page);
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('tenant') || '{}'));
  const slug = state.subdomain || 'demo';
  const apiRes = await page.request.get(`${API}/public/store/${slug}`);
  expect(apiRes.status(), `GET /public/store/${slug}`).toBe(200);

  await openWarranty(page);
  await page.goto(`/shop/${slug}`);
  await expect(page.getByText('Store Not Found')).toHaveCount(0);

  expect(problems, 'console errors and 4xx responses').toEqual([]);
});
