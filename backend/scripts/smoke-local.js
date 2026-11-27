// backend/scripts/smoke-local.js
//
// Fast smoke test against the running local dev servers and the NATIVE dev
// database. It never accepts a remote host and never touches the test DB.
//
//   npm run dev          (in one terminal)
//   npm run smoke:local  (in another)
//
// Checks: /health, login, the main list routes, and one create/update/delete
// cycle for categories, suppliers, customers and products. Every check fails
// loudly on a non-2xx response; no credential or token is printed.
const { loadDevEnv } = require('./dev-env');

const { mode } = loadDevEnv();
const { assertDevDatabaseUrl, isLocal } = require('./_guard');

const API = (process.env.SMOKE_API_URL || 'http://127.0.0.1:5000').replace(/\/+$/, '');
const API_BASE = API.endsWith('/api') ? API : `${API}/api`;
const HEALTH = `${API}/health`;
const ADMIN = { username: 'demo_admin', password: 'Demo1234!' };
const STAMP = Date.now();

async function request(label, path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${label}: HTTP ${res.status} ${path} -> ${text.slice(0, 300)}`);
  }
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  console.log(`  ok  ${label} (${res.status})`);
  return body;
}

function rowsOf(body) {
  if (Array.isArray(body)) return body;
  if (body && Array.isArray(body.products)) return body.products;
  if (body && Array.isArray(body.orders)) return body.orders;
  return null;
}

async function main() {
  if (mode !== 'local') {
    throw new Error('smoke:local requires DEV_DB_MODE=local (it must never touch the Docker test DB)');
  }
  const identity = assertDevDatabaseUrl(process.env.DATABASE_URL);
  if (!isLocal(process.env.DATABASE_URL)) {
    throw new Error(`refusing to smoke a non-local database (${identity.host})`);
  }

  console.log(`smoke target: ${API_BASE} (database ${identity.database} on ${identity.host}:${identity.port})`);

  const healthRes = await fetch(HEALTH);
  const health = await healthRes.json().catch(() => ({}));
  if (!healthRes.ok || health.db !== 'connected') {
    throw new Error(`health: HTTP ${healthRes.status} ${JSON.stringify(health)}`);
  }
  console.log(`  ok  GET /health (${healthRes.status}, db=${health.db})`);

  const login = await request('POST /auth/login', '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ADMIN),
  });
  if (!login || !login.token) throw new Error('login returned no token');
  console.log(`  ok  login as ${login.user.username} (${login.user.role})`);

  const headers = {
    Authorization: `Bearer ${login.token}`,
    'Content-Type': 'application/json',
  };
  if (login.user.tenant && login.user.tenant.id) {
    headers['x-tenant-id'] = String(login.user.tenant.id);
    headers['x-tenant-subdomain'] = String(login.user.tenant.subdomain || '');
  }

  const listChecks = [
    ['GET /products', '/products?limit=5'],
    ['GET /categories', '/categories'],
    ['GET /customers', '/customers'],
    ['GET /suppliers', '/suppliers'],
    ['GET /users', '/users'],
    ['GET /stock', '/stock'],
    ['GET /orders', '/orders?limit=5'],
    ['GET /activity-logs', '/activity-logs?limit=5'],
    ['GET /dashboard/stats', '/dashboard/stats'],
  ];
  for (const [label, path] of listChecks) {
    const body = await request(label, path, { headers });
    const rows = rowsOf(body);
    if (rows) console.log(`       ${rows.length} row(s)`);
  }

  // ---- category CRUD -------------------------------------------------------
  const category = await request('POST /categories', '/categories', {
    method: 'POST', headers, body: JSON.stringify({ name: `Smoke Category ${STAMP}` }),
  });
  const categoryId = category.id;
  await request('PUT /categories/:id', `/categories/${categoryId}`, {
    method: 'PUT', headers, body: JSON.stringify({ name: `Smoke Category ${STAMP} edited` }),
  });
  await request('DELETE /categories/:id', `/categories/${categoryId}`, { method: 'DELETE', headers });

  // ---- supplier CRUD -------------------------------------------------------
  const supplier = await request('POST /suppliers', '/suppliers', {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: `Smoke Supplier ${STAMP}`, contact_person: 'Smoke', phone: '010000000' }),
  });
  const supplierId = supplier.SUP_ID;
  await request('PUT /suppliers/:id', `/suppliers/${supplierId}`, {
    method: 'PUT', headers, body: JSON.stringify({ name: `Smoke Supplier ${STAMP} edited` }),
  });
  await request('DELETE /suppliers/:id', `/suppliers/${supplierId}`, { method: 'DELETE', headers });

  // ---- customer CRUD (delete is a status change) ---------------------------
  const customer = await request('POST /customers', '/customers', {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: `Smoke Customer ${STAMP}`, phone: '011111111' }),
  });
  const customerId = customer.id;
  await request('PUT /customers/:id', `/customers/${customerId}`, {
    method: 'PUT', headers, body: JSON.stringify({ name: `Smoke Customer ${STAMP} edited` }),
  });
  await request('DELETE /customers/:id', `/customers/${customerId}`, { method: 'DELETE', headers });

  // ---- product CRUD (delete deactivates the product) -----------------------
  const barcode = `SMOKE-${STAMP}`;
  const product = await request('POST /products', '/products', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: `Smoke Product ${STAMP}`,
      barcode,
      price: 9.99,
      cost: 4.5,
      stock: 3,
    }),
  });
  const productId = product.id;
  await request('PUT /products/:id', `/products/${productId}`, {
    method: 'PUT', headers, body: JSON.stringify({ name: `Smoke Product ${STAMP} edited`, price: 10.5 }),
  });
  await request('DELETE /products/:id', `/products/${productId}`, { method: 'DELETE', headers });

  const productPage = await request('GET /products (after CRUD)', '/products?limit=200', { headers });
  const found = rowsOf(productPage).find((p) => Number(p.id) === Number(productId));
  if (!found || String(found.status).toLowerCase() !== 'inactive') {
    throw new Error('product smoke did not observe the deactivated product row');
  }
  console.log('  ok  product row exists and is inactive after DELETE');

  console.log('smoke:local passed');
}

main().catch((err) => {
  console.error('smoke:local FAILED:', err.message);
  process.exit(1);
});
