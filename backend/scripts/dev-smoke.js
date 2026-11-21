// backend/scripts/dev-smoke.js
//
// Self-contained dev smoke: starts backend + Vite dev frontend against the
// disposable TEST database, visits every app route, opens create/edit modals,
// and fails on any console.error, console.warn, pageerror, or 4xx/5xx
// response. Also performs a rendered-DOM placeholder scan per route. Cleans up
// all child processes on exit. No hand-started servers required.
process.env.SPMS_DB_MODE = 'test';
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = require('./_guard').testDatabaseUrl();
}

const path = require('path');
const net = require('net');
const { spawn } = require('child_process');
const { execFileSync } = require('child_process');

const { TEST_DB_PORT, preflightTestDocker } = require('./_guard');
const { testDatabaseUrl } = require('./_guard');

const ROOT = path.join(__dirname, '..', '..');
const BACKEND = path.join(__dirname, '..');
const FRONTEND = path.join(ROOT, 'frontend');
const COMPOSE_FILE = path.join(ROOT, 'docker-compose.test.yml');

const BACKEND_PORT = 5000;
const FRONTEND_PORT = 5173;
const API_ORIGIN = `http://127.0.0.1:${BACKEND_PORT}`;
const API = `${API_ORIGIN}/api`;
const WEB = `http://127.0.0.1:${FRONTEND_PORT}`;

const USERS = {
  admin: { username: 'demo_admin', password: 'Demo1234!' },
  staff: { username: 'demo_staff', password: 'Demo1234!' },
  viewer: { username: 'demo_viewer', password: 'Demo1234!' },
};
const PLACEHOLDER_BAD = [
  /\bUnknown\b/,
  /\bN\/A\b/,
  /\bundefined\b/,
  /\bnull\b/,
  /\bNaN\b/,
  /\[object Object\]/,
  /Demo Product/i,
];

function portAnswers(port) {
  return new Promise(resolve => {
    const socket = net.connect({ host: '127.0.0.1', port });
    const finish = value => { socket.destroy(); resolve(value); };
    socket.setTimeout(750);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function assertPortsFree() {
  for (const [port, label] of [[BACKEND_PORT, 'backend'], [FRONTEND_PORT, 'frontend dev']]) {
    if (await portAnswers(port)) {
      throw new Error(`dev-smoke ${label} port ${port} is already in use (clean environment required)`);
    }
  }
}

function testDbReachable() {
  return new Promise(resolve => {
    const { Client } = require('pg');
    const client = new Client({ connectionString: testDatabaseUrl(), connectionTimeoutMillis: 2000 });
    client.on('error', () => {});
    client.connect()
      .then(() => client.query('SELECT 1'))
      .then(() => resolve(true))
      .catch(() => resolve(false))
      .finally(() => client.end().catch(() => {}));
  });
}

async function ensureViewerUser() {
  const { Client } = require('pg');
  const bcrypt = require('bcryptjs');
  const client = new Client({ connectionString: testDatabaseUrl() });
  await client.connect();
  try {
    const tenantRes = await client.query("SELECT id FROM tenants WHERE subdomain = 'demo'");
    const tenantId = tenantRes.rows[0] && tenantRes.rows[0].id;
    if (!tenantId) throw new Error('demo tenant not found after seed');
    const existing = await client.query(
      'SELECT userid FROM tbl_users WHERE username = $1 AND tenant_id = $2',
      [USERS.viewer.username, tenantId]
    );
    if (existing.rows.length === 0) {
      await client.query(
        `INSERT INTO tbl_users (username, email, password, fullname, role, status, tenant_id, must_change_password)
         VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6, FALSE)`,
        [
          USERS.viewer.username,
          `${USERS.viewer.username}@demo.test`,
          bcrypt.hashSync(USERS.viewer.password, 10),
          'Demo Viewer',
          'Viewer',
          tenantId,
        ]
      );
      console.log('dev-smoke: created demo_viewer user');
    } else {
      console.log('dev-smoke: demo_viewer user already present');
    }
  } finally {
    await client.end().catch(() => {});
  }
}

async function ensureTestDb() {
  if (await testDbReachable()) {
    console.log('dev-smoke: test database reachable');
  } else {
    await preflightTestDocker(TEST_DB_PORT);
    execFileSync('docker', ['compose', '-f', COMPOSE_FILE, 'up', '-d', '--wait'], { cwd: ROOT, stdio: 'inherit' });
  }
  console.log('dev-smoke: rebuilding spms_test through the real runner...');
  const { buildTestDatabase } = require('./test-db');
  await buildTestDatabase('spms_test');
  console.log('dev-smoke: seeding demo shop...');
  const { seed } = require('./seed-demo');
  await seed();
  await ensureViewerUser();
}

async function waitFor(url, label, timeoutMs = 120000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`${label} did not answer ${url} within ${timeoutMs}ms`);
}

function killTree(child) {
  if (!child || child.killed) return;
  try {
    if (process.platform === 'win32') {
      execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  } catch (e) {}
}

function startServers() {
  const envBase = {
    ...process.env,
    SPMS_DB_MODE: 'test',
    DATABASE_URL: testDatabaseUrl(),
    NODE_ENV: 'development',
    BAKONG_ACCOUNT_ID: process.env.BAKONG_ACCOUNT_ID || 'abaakhppxxx@abaa',
  };
  delete envBase.ALLOW_REMOTE_DB;
  delete envBase.RENDER;

  const backend = spawn(process.execPath, [path.join(BACKEND, 'src', 'app.js')], {
    cwd: BACKEND,
    stdio: 'pipe',
    env: {
      ...envBase,
      PORT: String(BACKEND_PORT),
      JWT_SECRET: process.env.DEV_SMOKE_JWT_SECRET || 'dev-smoke-jwt-secret-0123456789abcdef',
      FRONTEND_URL: WEB,
      CORS_ORIGINS: `${WEB},http://localhost:${FRONTEND_PORT}`,
    },
  });
  backend.stdout.on('data', d => process.stdout.write(`[backend] ${d}`));
  backend.stderr.on('data', d => process.stderr.write(`[backend] ${d}`));

  const viteJs = path.join(FRONTEND, 'node_modules', 'vite', 'bin', 'vite.js');
  const frontend = spawn(process.execPath, [viteJs, '--host', '127.0.0.1', '--port', String(FRONTEND_PORT), '--strictPort'], {
    cwd: FRONTEND,
    stdio: 'pipe',
    env: { ...envBase, VITE_API_URL: API },
  });
  frontend.stdout.on('data', d => process.stdout.write(`[frontend] ${d}`));
  frontend.stderr.on('data', d => process.stderr.write(`[frontend] ${d}`));

  return { backend, frontend };
}

async function login(page, user) {
  await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="username"]').fill(user.username);
  await page.locator('input[name="password"]').fill(user.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
  const welcome = page.getByRole('button', { name: /Enter Control Center/i });
  if (await welcome.isVisible().catch(() => false)) await welcome.click();
  // dismiss toasts/overlays that can intercept clicks
  await page.keyboard.press('Escape').catch(() => {});
}

function attachCollectors(page, failures, routeLabel) {
  page.on('console', msg => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      failures.push({ route: routeLabel, kind: `console.${type}`, detail: msg.text() });
    }
  });
  page.on('pageerror', err => {
    failures.push({ route: routeLabel, kind: 'pageerror', detail: String(err && err.message || err) });
  });
  page.on('response', res => {
    const status = res.status();
    if (status >= 400) {
      const url = res.url();
      // Ignore sourcemap/dev noise and favicon
      if (url.includes('.map') || url.endsWith('/favicon.ico')) return;
      failures.push({ route: routeLabel, kind: `http${status}`, detail: `${status} ${url}` });
    }
  });
}

async function scanPlaceholders(page, failures, routeLabel) {
  try {
    const hits = await page.evaluate((patterns) => {
      const text = (document.body && document.body.innerText) || '';
      const found = [];
      for (const p of patterns) {
        const re = new RegExp(p.source, p.flags);
        if (re.test(text)) found.push(re.toString());
      }
      // empty name-like cells
      const empties = Array.from(document.querySelectorAll('td, .name, .product-name, .customer-name'))
        .filter(el => {
          const t = (el.textContent || '').trim();
          return t === '' && el.offsetParent !== null;
        }).length;
      if (empties > 5) found.push(`empty name/cell count=${empties}`);
      return found;
    }, PLACEHOLDER_BAD.map(r => ({ source: r.source, flags: r.flags })));
    for (const h of hits) failures.push({ route: routeLabel, kind: 'placeholder-dom', detail: h });
  } catch (e) {
    failures.push({ route: routeLabel, kind: 'scan-error', detail: String(e.message || e) });
  }
}

async function openCreateEditModals(page, failures, routeLabel) {
  // Try "Add"/"New"/"Create" buttons
  const addSelectors = [
    'button:has-text("Add")',
    'button:has-text("New")',
    'button:has-text("Create")',
    'button:has-text("+")',
  ];
  for (const sel of addSelectors) {
    const btns = page.locator(sel);
    const count = await btns.count().catch(() => 0);
    for (let i = 0; i < Math.min(count, 2); i++) {
      const b = btns.nth(i);
      if (!(await b.isVisible().catch(() => false))) continue;
      const text = (await b.textContent().catch(() => '')) || '';
      // avoid destructive/confusing buttons
      if (/logout|sign out|delete|remove|clear/i.test(text)) continue;
      try {
        await b.click({ timeout: 3000 });
        await page.waitForTimeout(400);
        await scanPlaceholders(page, failures, `${routeLabel} [modal:add:${text.trim().slice(0,30)}]`);
        // close modal via Escape or close buttons
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(200);
        const closeBtns = page.locator('button:has-text("Cancel"), button:has-text("Close"), button[aria-label="Close"], button[aria-label="Dismiss"], .modal-close, [class*="close"]');
        if (await closeBtns.first().isVisible().catch(() => false)) {
          await closeBtns.first().click({ timeout: 1500 }).catch(() => {});
        }
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(200);
      } catch (e) {
        // non-fatal interaction issue recorded as warning-equivalent? spec says fail on console.warn/pageerror/4xx/5xx - interaction failures we note
        failures.push({ route: routeLabel, kind: 'modal-open-failed', detail: `${sel} -> ${String(e.message || e).slice(0,120)}` });
      }
    }
  }
  // Try edit buttons (title/icon)
  const editBtns = page.locator('button[title="Edit"], button[aria-label*="Edit"], button:has-text("Edit")');
  const ecount = await editBtns.count().catch(() => 0);
  if (ecount > 0) {
    const b = editBtns.first();
    if (await b.isVisible().catch(() => false)) {
      try {
        await b.click({ timeout: 3000 });
        await page.waitForTimeout(400);
        await scanPlaceholders(page, failures, `${routeLabel} [modal:edit]`);
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(200);
        const closeBtns = page.locator('button:has-text("Cancel"), button:has-text("Close"), button[aria-label="Close"]');
        if (await closeBtns.first().isVisible().catch(() => false)) {
          await closeBtns.first().click({ timeout: 1500 }).catch(() => {});
        }
        await page.keyboard.press('Escape').catch(() => {});
      } catch (e) {
        failures.push({ route: routeLabel, kind: 'modal-edit-failed', detail: String(e.message || e).slice(0,120) });
      }
    }
  }
}

async function waitForRouteData(page, route) {
  if (route === '/reports') {
    // Wait for a real reports data request or a visible data row before scanning.
    const responseWait = page.waitForResponse(
      (res) => {
        const url = res.url();
        return url.includes('/api/reports') && res.status() < 400;
      },
      { timeout: 20000 }
    ).catch(() => null);
    const rowWait = page.locator('table tbody tr, .report-row, [class*="report"] tbody tr').first()
      .waitFor({ state: 'visible', timeout: 20000 }).catch(() => null);
    await Promise.race([responseWait, rowWait]);
    return;
  }
  if (route === '/analytics') {
    // Wait for a real analytics data request or a visible data row before scanning.
    const responseWait = page.waitForResponse(
      (res) => {
        const url = res.url();
        return (url.includes('/api/dashboard/analytics-summary') || url.includes('/api/analytics')) && res.status() < 400;
      },
      { timeout: 20000 }
    ).catch(() => null);
    const rowWait = page.locator('table tbody tr, .analytics-table tbody tr, [class*="chart"], canvas, svg.recharts-surface').first()
      .waitFor({ state: 'visible', timeout: 20000 }).catch(() => null);
    await Promise.race([responseWait, rowWait]);
    return;
  }
}

async function visitRoute(page, route, failures, setRoute, options = {}) {
  const label = options.label || route;
  if (setRoute) setRoute(label);
  const url = `${WEB}${route}`;

  // For routes that need data-wait, arm the wait before navigation when possible.
  let dataWaitPromise = null;
  if (route === '/reports' || route === '/analytics') {
    dataWaitPromise = waitForRouteData(page, route);
  }

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => {
    failures.push({ route: label, kind: 'navigation', detail: String(e.message || e) });
  });

  // Handle expected viewer redirects away from restricted routes.
  if (options.expectRedirectTo) {
    await page.waitForURL(options.expectRedirectTo, { timeout: 15000 }).catch(e => {
      failures.push({ route: label, kind: 'redirect', detail: `expected redirect to ${options.expectRedirectTo}, got ${page.url()} (${String(e.message || e)})` });
    });
    await page.waitForTimeout(800);
    return;
  }

  if (dataWaitPromise) await dataWaitPromise;
  await page.waitForTimeout(1500);
  await scanPlaceholders(page, failures, label);
  await openCreateEditModals(page, failures, label);
}

async function runRolePass(browser, roleName, user, routesConfig, failures) {
  console.log(`dev-smoke: role pass ${roleName} (${user.username})`);
  const context = await browser.newContext();
  const page = await context.newPage();
  let currentRoute = `${roleName}:global`;
  const setRoute = (r) => { currentRoute = `${roleName}:${r}`; };

  page.on('console', msg => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      failures.push({ route: currentRoute, kind: `console.${type}`, detail: msg.text() });
    }
  });
  page.on('pageerror', err => {
    failures.push({ route: currentRoute, kind: 'pageerror', detail: String(err && err.message || err) });
  });
  page.on('response', res => {
    const status = res.status();
    if (status >= 400) {
      const url = res.url();
      if (url.includes('.map') || url.endsWith('/favicon.ico') || url.includes('__vite') || url.includes('hot-update')) return;
      failures.push({ route: currentRoute, kind: `http${status}`, detail: `${status} ${url}` });
    }
  });

  await login(page, user);
  for (const route of routesConfig) {
    const path = typeof route === 'string' ? route : route.path;
    const opts = typeof route === 'string' ? {} : route;
    console.log(`dev-smoke: [${roleName}] visiting ${path}${opts.expectRedirectTo ? ' (expect redirect)' : ''}`);
    await visitRoute(page, path, failures, setRoute, opts);
  }

  await context.close();
}

async function main() {
  await assertPortsFree();
  await ensureTestDb();
  const { backend, frontend } = startServers();
  let stopping = false;
  const cleanup = () => {
    if (stopping) return;
    stopping = true;
    killTree(frontend);
    killTree(backend);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', cleanup);

  try {
    console.log('dev-smoke: waiting for backend...');
    await waitFor(`${API_ORIGIN}/health`, 'backend', 120000);
    console.log('dev-smoke: waiting for frontend dev server...');
    await waitFor(WEB, 'frontend dev', 180000);

    let chromium;
    try {
      ({ chromium } = require('playwright'));
    } catch (e1) {
      try {
        ({ chromium } = require('@playwright/test'));
      } catch (e2) {
        throw new Error('Playwright is required for dev-smoke (chromium)');
      }
    }
    const browser = await chromium.launch({ headless: true });
    const failures = [];

    const adminRoutes = [
      '/dashboard',
      '/orders',
      '/sell',
      '/online-orders',
      '/products',
      '/customers',
      '/stock',
      '/suppliers',
      '/reports',
      '/users',
      '/activity',
      '/warranty',
      '/analytics',
      '/profile',
      '/settings',
      '/help',
      '/pricing',
    ];

    // Staff: pages this role may open without admin-only API 4xx/5xx.
    // Excludes /users and /reports (admin-only by backend role policy).
    const staffRoutes = [
      '/dashboard',
      '/orders',
      '/sell',
      '/online-orders',
      '/products',
      '/customers',
      '/stock',
      '/suppliers',
      '/activity',
      '/warranty',
      '/profile',
      '/settings',
      '/help',
      '/pricing',
    ];

    // Viewer: read-only; redirected away from /sell and /activity.
    // Excludes admin-only pages (/users, /reports) and /analytics (calls admin-only APIs).
    const viewerRoutes = [
      '/dashboard',
      '/orders',
      { path: '/sell', expectRedirectTo: /\/dashboard/ },
      '/online-orders',
      '/products',
      '/customers',
      '/stock',
      '/suppliers',
      { path: '/activity', expectRedirectTo: /\/dashboard/ },
      '/warranty',
      '/profile',
      '/settings',
      '/help',
      '/pricing',
    ];

    await runRolePass(browser, 'admin', USERS.admin, adminRoutes, failures);
    await runRolePass(browser, 'staff', USERS.staff, staffRoutes, failures);
    await runRolePass(browser, 'viewer', USERS.viewer, viewerRoutes, failures);

    // Public storefront route (no auth required) - checked once.
    console.log('dev-smoke: visiting /shop/demo');
    const pubContext = await browser.newContext();
    const pubPage = await pubContext.newPage();
    let pubRoute = 'public:/shop/demo';
    pubPage.on('console', msg => {
      const type = msg.type();
      if (type === 'error' || type === 'warning') failures.push({ route: pubRoute, kind: `console.${type}`, detail: msg.text() });
    });
    pubPage.on('pageerror', err => {
      failures.push({ route: pubRoute, kind: 'pageerror', detail: String(err && err.message || err) });
    });
    pubPage.on('response', res => {
      const status = res.status();
      if (status >= 400) {
        const url = res.url();
        if (url.includes('.map') || url.endsWith('/favicon.ico') || url.includes('__vite') || url.includes('hot-update')) return;
        failures.push({ route: pubRoute, kind: `http${status}`, detail: `${status} ${url}` });
      }
    });
    await pubPage.goto(`${WEB}/shop/demo`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => {
      failures.push({ route: '/shop/demo', kind: 'navigation', detail: String(e.message || e) });
    });
    await pubPage.waitForTimeout(1500);
    await scanPlaceholders(pubPage, failures, '/shop/demo');
    await pubContext.close();

    await browser.close();

    if (failures.length) {
      console.error('dev-smoke: FAILURES');
      for (const f of failures) {
        console.error(`  [${f.kind}] ${f.route} :: ${f.detail}`);
      }
      console.error(`dev-smoke: ${failures.length} issue(s)`);
      process.exitCode = 1;
    } else {
      console.log('dev-smoke: passed');
    }
  } finally {
    cleanup();
  }
}

main().catch(err => {
  console.error('dev-smoke: FAILED:', err && err.stack || err);
  process.exit(1);
});
