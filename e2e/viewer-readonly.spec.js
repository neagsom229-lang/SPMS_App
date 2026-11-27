// New tests: Viewer must be read-only on tenant writes. No existing test is edited.
const { test, expect } = require('@playwright/test');
const { Client } = require('../backend/node_modules/pg');
const jwt = require('../backend/node_modules/jsonwebtoken');
const bcrypt = require('../backend/node_modules/bcryptjs');
const { testDatabaseUrl } = require('../backend/scripts/_guard');
const { API_URL } = require('../backend/scripts/e2e-ports');

const API = process.env.E2E_API_URL || API_URL;
const SECRET = process.env.E2E_JWT_SECRET || 'e2e-only-jwt-secret-0123456789abcdef';
const SUFFIX = String(Date.now());
let client;
let ctx = {};

async function insertUser(role) {
  const uname = `vr_${role.replace(/\W/g, '')}_${SUFFIX}_${Math.random().toString(16).slice(2)}`.toLowerCase();
  await client.query(
    `INSERT INTO tbl_users (username,email,password,fullname,role,status,tenant_id,must_change_password)
     VALUES ($1,$2,$3,$4,$5,'ACTIVE',$6,FALSE)`,
    [uname, `${uname}@e2e.test`, bcrypt.hashSync('Test1234!', 10), uname, role, ctx.tenantId]
  );
  const id = (await client.query('SELECT userid FROM tbl_users WHERE username=$1', [uname])).rows[0].userid;
  return jwt.sign({ userId: id, username: uname, role, tenantId: ctx.tenantId, isSuperAdmin: false }, SECRET, { expiresIn: '1h' });
}

test.beforeAll(async () => {
  const url = testDatabaseUrl();
  const parsed = new URL(url);
  if (parsed.port !== '15432' || !parsed.pathname.endsWith('_test')) {
    throw new Error(`refusing to run: DB target is ${parsed.hostname}:${parsed.port}${parsed.pathname}`);
  }
  client = new Client({ connectionString: url });
  await client.connect();
  await client.query("DELETE FROM tbl_orders WHERE idempotency_key LIKE 'vr-%'");
  await client.query("DELETE FROM tbl_customers WHERE phone LIKE 'VRPH-%'");
  await client.query("DELETE FROM tbl_users WHERE username LIKE 'vr_%'");
  const t = await client.query("SELECT id FROM tenants WHERE subdomain='demo'");
  ctx.tenantId = t.rows[0].id;
  const prod = await client.query('SELECT id FROM tbl_products WHERE tenant_id=$1 LIMIT 1', [ctx.tenantId]);
  ctx.productId = prod.rows[0].id;
  const customer = await client.query(
    `INSERT INTO tbl_customers (cus_id, name, phone, tenant_id) VALUES ($1,$2,$3,$4) RETURNING id`,
    [`VR-${SUFFIX}`, `VR Base ${SUFFIX}`, `VRPH-${SUFFIX}`, ctx.tenantId]
  );
  ctx.customerId = customer.rows[0].id;
  ctx.viewer = await insertUser('Viewer');
  ctx.viewerUpper = await insertUser('VIEWER');
  ctx.staff = await insertUser('Staff');
  ctx.admin = await insertUser('Admin');
});

test.afterAll(async () => {
  if (!client) return;
  await client.query("DELETE FROM tbl_orders WHERE idempotency_key LIKE 'vr-%'");
  await client.query("DELETE FROM tbl_customers WHERE phone LIKE 'VRPH-%'");
  await client.query("DELETE FROM tbl_users WHERE username LIKE 'vr_%'");
  await client.end();
});

function call(request, token, method, path, data) {
  return request[method](`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data,
  });
}

async function expectDenied(request, token, method, path, data) {
  const res = await call(request, token, method, path, data);
  expect(res.status(), `${method} ${path}`).toBe(403);
}

test('Viewer cannot create a customer', async ({ request }) => {
  await expectDenied(request, ctx.viewer, 'post', '/customers', { name: `VR C ${SUFFIX}`, phone: `VRPH-C-${SUFFIX}` });
});

test('VIEWER (uppercase) cannot create a customer', async ({ request }) => {
  await expectDenied(request, ctx.viewerUpper, 'post', '/customers', { name: `VR U ${SUFFIX}`, phone: `VRPH-U-${SUFFIX}` });
});

test('Viewer cannot edit a customer', async ({ request }) => {
  await expectDenied(request, ctx.viewer, 'put', `/customers/${ctx.customerId}`, { name: `VR edit ${SUFFIX}` });
});

test('Viewer cannot delete a customer', async ({ request }) => {
  await expectDenied(request, ctx.viewer, 'delete', `/customers/${ctx.customerId}`);
});

test('Viewer cannot create a warranty', async ({ request }) => {
  await expectDenied(request, ctx.viewer, 'post', '/warranties', { CustomerID: ctx.customerId, ProductID: ctx.productId, SerialNumber: `VR-${SUFFIX}` });
});

test('Viewer cannot create a service', async ({ request }) => {
  await expectDenied(request, ctx.viewer, 'post', '/services', { CustomerID: ctx.customerId, ProductID: ctx.productId, IssueDescription: `VR ${SUFFIX}` });
});

test('Viewer cannot create a POS order', async ({ request }) => {
  await expectDenied(request, ctx.viewer, 'post', '/orders', {
    customer_id: ctx.customerId,
    items: [{ product_id: ctx.productId, qty: 1, price: 1 }],
    payment_method: 'Cash',
    idempotency_key: `vr-${SUFFIX}`,
  });
});

test('Staff can still create a customer (regression guard)', async ({ request }) => {
  const res = await call(request, ctx.staff, 'post', '/customers', { name: `VR S ${SUFFIX}`, phone: `VRPH-S-${SUFFIX}` });
  expect(res.status()).toBe(201);
});

test('Admin can still create a customer (regression guard)', async ({ request }) => {
  const res = await call(request, ctx.admin, 'post', '/customers', { name: `VR A ${SUFFIX}`, phone: `VRPH-A-${SUFFIX}` });
  expect(res.status()).toBe(201);
});
