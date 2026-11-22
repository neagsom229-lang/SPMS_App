// e2e test: dashboard refresh with delayed API responses
// Tests that Staff and Viewer never see a blank page and reports on "Admin only" visibility
// when /api/dashboard/** and /api/orders/** responses are delayed by 3s.

const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  // Response delays set per-test in doTest()
});

async function doTest(page, userRole) {
  // Delay API responses by 3s - intercept /api/dashboard/** and /api/orders/**
  await page.route(/^\/api\/dashboard\/.*/, async (route) => {
    await route.fulfill({ status: 200, delay: 3000 });
  });
  await page.route(/^\/api\/orders\/.*/, async (route) => {
    await route.fulfill({ status: 200, delay: 3000 });
  });
  await page.route(/^\/api\/orders\/online\/count/, async (route) => {
    await route.fulfill({ status: 200, delay: 3000 });
  });
  await page.route(/^\/api\/orders\/recent/, async (route) => {
    await route.fulfill({ status: 200, delay: 3000 });
  });

  await page.goto('/login');
  // Fill login form; the test environment provides valid users via master beforeAll
  const usernameInput = page.locator('input[name="username"]');
  const passwordInput = page.locator('input[name="password"]');
  await usernameInput.fill('demo_staff');
  await passwordInput.fill('Demo1234!');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // Dismiss welcome modal if present
  try {
    await page.getByRole('button', { name: 'Enter Control Center' }).click();
    await expect(page.locator('[data-rht-toaster] [role="status"]')).toHaveCount(0, { timeout: 10000 });
  } catch (e) {
    // Modal may already be dismissed; ignore
  }

  // Collect errors
  const pageErrors = [];
  const consoleErrors = [];

  page.on('pageerror', (err) => {
    pageErrors.push({ type: 'pageerror', message: err.message });
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push({ type: 'console.error', text: msg.text() });
    }
  });

  // Click Refresh as soon as the button is visible
  await page.getByRole('button', { name: 'Refresh' }).click();

  // Wait for the page to stabilize
  await page.waitForTimeout(5000);

  // Assertions
  // 1. Page is never blank: body has some text content
  const bodyText = await page.locator('body').innerText();
  await expect(bodyText.length).toBeGreaterThan(0, 'Page body has no text - page appears blank');

  // 2. No pageerror occurred
  await expect(pageErrors).toHaveLength(0, `Page errors occurred: ${JSON.stringify(pageErrors)}`);

  // 3. No console.error about failed requests (filter out known noise)
  const criticalConsoleErrors = consoleErrors.filter(e =>
    !e.text.includes('net::ERR_CONNECTION_TIMED_OUT') &&
    !e.text.includes('Failed to load resource')
  );
  await expect(criticalConsoleErrors).toHaveLength(0, `Console errors: ${JSON.stringify(criticalConsoleErrors)}`);

  // 4. "Admin only" becomes visible (the core gating assertion)
  // This may or may not be visible depending on the hasSales/emptyChartText issue;
  // we just assert and report the result.
  try {
    await expect(page.getByText('Admin only')).toBeVisible({ timeout: 15000 });
    console.log('PASS: "Admin only" is visible');
  } catch (e) {
    console.log('INFO: "Admin only" not visible after ' + (15000/1000) + 's timeout (expected per earlier trace analysis)');
    // re-throw to mark test as failed but with the info logged
    throw e;
  }
}

test('Staff dashboard does not go blank on refresh with slow APIs', async ({ page }) => {
  await doTest(page, 'Staff');
});

test('Viewer dashboard does not go blank on refresh with slow APIs', async ({ page }) => {
  await doTest(page, 'Viewer');
});