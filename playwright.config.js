// playwright.config.js
//
// One golden-path test, chromium only, against a real backend on the test DB
// and a production build of the frontend. The webServer command runs the e2e
// setup (test DB + demo seed + frontend build) and then both servers.
const { defineConfig, devices } = require('@playwright/test');

const WEB = process.env.E2E_WEB_URL || 'http://127.0.0.1:4173';

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: WEB,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'node backend/scripts/e2e-servers.js',
    url: WEB,
    timeout: 300_000,
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
