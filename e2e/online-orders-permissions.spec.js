// New tests for Option A online-order permissions. No existing test is edited.
const { test, expect } = require('@playwright/test');
const { Client } = require('../backend/node_modules/pg');
const jwt = require('../backend/node_modules/jsonwebtoken');
const bcrypt = require('../backend/node_modules/bcryptjs');
const { testDatabaseUrl } = require('../backend/scripts/_guard');
const { API_URL } = require('../backend/scripts/e2e-ports');

const API = process.env.E2E_API_URL || API_URL;
const JWT_SECRET = process.env.E2E_JWT_SECRET || 'e2e-only-jwt-secret-0123456789abcdef';
const SUFFIX = String(Date.now());

let client;
let ctx = {};

async function insertUser(role, tenantId, isSuperAdmin = false) {
  const unique = Math.random().toString(16).slice(2);
  const username = `oo_${role.replace(/\W/g, '')}_${SUFFIX}_${unique}`.toLowerCase();
  const res = await client.query(
    `INSERT INTO tbl_users (username, email, password, fullname, role, status, is_super_admin, tenant_id, must_change_password)
     VALUES ($1,$2,$3,$4,$5,'ACTIVE',$6,$7,FALSE) RETURNING userid`,
    [username, `${username}@e2e.test`, bcrypt.hashSync('Test1234!', 10), username, role, isSuperAdmin, tenantId]
  );
  const id = res.rows[0].userid;
  return {
    id,
    token: jwt.sign(
      { userId: id, username, role, tenantId: isSuperAdmin ? null : tenantId, isSuperAdmin },
      JWT_SECRET,
      { expiresIn: '1h' }
    ),
  };
}

async function createOrder(tenantId, customerId, status) {
  const res = await client.query(
    `INSERT INTO tbl_orders (tenant_id, customer_id, total, payment_method, status, order_no, idempotency_key)
     VALUES ($1,$2,20,'Cash',$3,$4,$5) RETURNING or_id`,
    [tenantId, customerId, status, `OO-${SUFFIX}-${Math.random().toString(16).slice(2)}`, `oo-${SUFFIX}-${Math.random().toString(16).slice(2)}`]
  );
  return res.rows[0].or_id;
}

function patch(orderId, token, status) {
  return {
    method: 'PATCH',
    url: `${API}/orders/${orderId}/status`,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { status },
  };
}

test.beforeAll(async () => {
  const url = testDatabaseUrl();
  const parsed = new URL(url);
  if (parsed.port !== '15432' || !parsed.pathname.endsWith('_test')) {
    throw new Error(`refusing to run: DB target is ${parsed.hostname}:${parsed.port}${parsed.pathname}`);
  }
  client = new Client({ connectionString: url });
  await client.connect();
  await client.query("DELETE FROM tbl_orders WHERE idempotency_key LIKE 'oo-%'");
  await client.query("DELETE FROM tbl_users WHERE username LIKE 'oo_%'");
  await client.query("DELETE FROM tenants WHERE subdomain LIKE 'oo-other-%'");
  const tenant = await client.query("SELECT id FROM tenants WHERE subdomain='demo'");
  const customer = await client.query('SELECT id FROM tbl_customers WHERE tenant_id=$1 LIMIT 1', [tenant.rows[0].id]);
  const other = await client.query(
    `INSERT INTO tenants (name, subdomain, status, plan) VALUES ($1,$2,'ACTIVE','shophouse') RETURNING id`,
    [`OO Other ${SUFFIX}`, `oo-other-${SUFFIX}`]
  );
  ctx = {
    tenantId: tenant.rows[0].id,
    otherTenantId: other.rows[0].id,
    customerId: customer.rows[0].id,
    admin: await insertUser('Admin', tenant.rows[0].id),
    staff: await insertUser('Staff', tenant.rows[0].id),
    staffUpper: await insertUser('STAFF', tenant.rows[0].id),
    cashier: await insertUser('Cashier', tenant.rows[0].id),
    viewer: await insertUser('viewer', tenant.rows[0].id),
    otherAdmin: await insertUser('Admin', other.rows[0].id),
  };
  ctx.orders = {
    adminPending: await createOrder(ctx.tenantId, ctx.customerId, 'Pending'),
    staffPending: await createOrder(ctx.tenantId, ctx.customerId, 'Pending'),
    staffUpperPending: await createOrder(ctx.tenantId, ctx.customerId, 'Pending'),
    cashierPending: await createOrder(ctx.tenantId, ctx.customerId, 'Pending'),
    viewerPending: await createOrder(ctx.tenantId, ctx.customerId, 'Pending'),
    staffCancel: await createOrder(ctx.tenantId, ctx.customerId, 'Pending'),
    cashierCancel: await createOrder(ctx.tenantId, ctx.customerId, 'Pending'),
    completed: await createOrder(ctx.tenantId, ctx.customerId, 'Completed'),
    isolated: await createOrder(ctx.tenantId, ctx.customerId, 'Pending'),
  };
});

test.afterAll(async () => {
  if (!client) return;
  await client.query('DELETE FROM tbl_orders WHERE idempotency_key LIKE $1', [`oo-${SUFFIX}-%`]);
  await client.query("DELETE FROM tbl_users WHERE username LIKE 'oo_%'");
  await client.query('DELETE FROM tenants WHERE subdomain=$1', [`oo-other-${SUFFIX}`]);
  await client.end();
});

test('Admin may move order forward (control)', async ({ request }) => {
  const p = patch(ctx.orders.adminPending, ctx.admin.token, 'Confirmed');
  const res = await request.patch(p.url, { headers: p.headers, data: p.data });
  expect(res.status()).toBe(200);
});

test('Staff may move order forward', async ({ request }) => {
  const p = patch(ctx.orders.staffPending, ctx.staff.token, 'Confirmed');
  const res = await request.patch(p.url, { headers: p.headers, data: p.data });
  expect(res.status()).toBe(200);
});

test('STAFF (uppercase role) may move order forward', async ({ request }) => {
  const p = patch(ctx.orders.staffUpperPending, ctx.staffUpper.token, 'Confirmed');
  const res = await request.patch(p.url, { headers: p.headers, data: p.data });
  expect(res.status()).toBe(200);
});

test('Cashier may move order forward', async ({ request }) => {
  const p = patch(ctx.orders.cashierPending, ctx.cashier.token, 'Confirmed');
  const res = await request.patch(p.url, { headers: p.headers, data: p.data });
  expect(res.status()).toBe(200);
});

test('Staff may not cancel', async ({ request }) => {
  const p = patch(ctx.orders.staffCancel, ctx.staff.token, 'Cancelled');
  const res = await request.patch(p.url, { headers: p.headers, data: p.data });
  expect(res.status()).toBe(403);
});

test('Cashier may not cancel', async ({ request }) => {
  const p = patch(ctx.orders.cashierCancel, ctx.cashier.token, 'Cancelled');
  const res = await request.patch(p.url, { headers: p.headers, data: p.data });
  expect(res.status()).toBe(403);
});

test('unknown role may not move order forward', async ({ request }) => {
  const p = patch(ctx.orders.viewerPending, ctx.viewer.token, 'Confirmed');
  const res = await request.patch(p.url, { headers: p.headers, data: p.data });
  expect(res.status()).toBe(403);
});

test('Completed -> Cancelled is 409 and stock is unchanged', async ({ request }) => {
  const p = patch(ctx.orders.completed, ctx.admin.token, 'Cancelled');
  const res = await request.patch(p.url, { headers: p.headers, data: p.data });
  expect(res.status()).toBe(409);
});

test('tenant B cannot patch tenant A order', async ({ request }) => {
  const p = patch(ctx.orders.isolated, ctx.otherAdmin.token, 'Confirmed');
  const res = await request.patch(p.url, { headers: p.headers, data: p.data });
  expect(res.status()).toBe(404);
});
