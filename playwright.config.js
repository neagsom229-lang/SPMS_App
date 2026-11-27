// playwright.config.js
//
// One golden-path test, chromium only, against a real backend on the test DB
// and a production build of the frontend. The webServer command runs the e2e
// setup (test DB + demo seed + frontend build) and then both servers.
const { defineConfig, devices } = require('@playwright/test');
const { WEB: DEFAULT_WEB } = require('./backend/scripts/e2e-ports');

const WEB = process.env.E2E_WEB_URL || DEFAULT_WEB;

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
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          // Bundled Chromium is the default. Set PLAYWRIGHT_CHANNEL=msedge
          // only on hosts where the bundled Chromium binary cannot spawn.
          ...(process.env.PLAYWRIGHT_CHANNEL
            ? { channel: process.env.PLAYWRIGHT_CHANNEL }
            : {}),
        },
      },
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
