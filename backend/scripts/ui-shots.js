// backend/scripts/ui-shots.js
// Quick visual review: screenshot the main routes at the four supported
// viewports into a gitignored folder. Run against a dev stack that is already
// up: UI_BASE_URL=http://127.0.0.1:5173 npm run ui:shots
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const BASE = process.env.UI_BASE_URL || 'http://127.0.0.1:5173';
const OUT = path.join(__dirname, '../../ui-shots');
const SIZES = [
  { name: '1344x960', width: 1344, height: 960 },
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
];
const ROUTES = [
  ['warranty', '/warranty'],
  ['dashboard', '/dashboard'],
  ['products', '/products'],
  ['orders', '/orders'],
  ['customers', '/customers'],
  ['storefront', '/shop/demo'],
];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  // Log in once and reuse the storage state for every viewport.
  const authContext = await browser.newContext({ viewport: { width: 1344, height: 960 } });
  const authPage = await authContext.newPage();
  await authPage.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await authPage.locator('input[name=username]').fill(process.env.UI_USER || 'demo_admin');
  await authPage.locator('input[name=password]').fill(process.env.UI_PASSWORD || 'Demo1234!');
  await authPage.locator('button[type=submit]').click();
  await authPage.waitForURL(/\/dashboard/, { timeout: 30000 });
  const storageState = await authContext.storageState();
  await authContext.close();

  for (const size of SIZES) {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      storageState,
    });
    const page = await context.newPage();
    for (const [name, route] of ROUTES) {
      // eslint-disable-next-line no-await-in-loop
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
      // eslint-disable-next-line no-await-in-loop
      await page.waitForTimeout(600);
      // eslint-disable-next-line no-await-in-loop
      await page.screenshot({ path: path.join(OUT, `${name}-${size.name}.png`) });
      if (name === 'warranty' && size.name === '1344x960') {
        // eslint-disable-next-line no-await-in-loop
        await page.locator('aside').screenshot({ path: path.join(OUT, `sidebar-${size.name}.png`) });
      }
    }
    await context.close();
  }

  await browser.close();
  console.log(`screenshots written to ${OUT}`);
}

main().catch((err) => {
  console.error('ui:shots failed:', err.message);
  process.exit(1);
});
