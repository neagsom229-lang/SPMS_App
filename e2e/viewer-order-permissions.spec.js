// New tests: Viewer role cannot move orders forward or cancel. No existing test is edited.
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

test.beforeAll(async () => {
  const url = testDatabaseUrl();
  const parsed = new URL(url);
  if (parsed.port !== '15432' || !parsed.pathname.endsWith('_test')) {
    throw new Error(`refusing to run: DB target is ${parsed.hostname}:${parsed.port}${parsed.pathname}`);
  }
  client = new Client({ connectionString: url });
  await client.connect();
  await client.query("DELETE FROM tbl_orders WHERE idempotency_key LIKE 'viewer-%'");
  await client.query("DELETE FROM tbl_users WHERE username LIKE 'viewer_%'");

  const tenant = await client.query("SELECT id FROM tenants WHERE subdomain='demo'");
  const customer = await client.query('SELECT id FROM tbl_customers WHERE tenant_id=$1 LIMIT 1', [tenant.rows[0].id]);
  const username = `viewer_order_${SUFFIX}`;
  const u = await client.query(
    `INSERT INTO tbl_users (username, email, password, fullname, role, status, tenant_id, must_change_password)
     VALUES ($1,$2,$3,$4,'Viewer','ACTIVE',$5,FALSE) RETURNING userid`,
    [username, `${username}@e2e.test`, bcrypt.hashSync('Test1234!', 10), username, tenant.rows[0].id]
  );
  const token = jwt.sign(
    { userId: u.rows[0].userid, username, role: 'Viewer', tenantId: tenant.rows[0].id, isSuperAdmin: false },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  ctx.token = token;
  ctx.orders = {};
  for (const name of ['forward', 'cancel']) {
    const r = await client.query(
      `INSERT INTO tbl_orders (tenant_id, customer_id, total, payment_method, status, order_no, idempotency_key)
       VALUES ($1,$2,20,'Cash','Pending',$3,$4) RETURNING or_id`,
      [tenant.rows[0].id, customer.rows[0].id, `VIEWER-${SUFFIX}-${name}`, `viewer-${SUFFIX}-${name}`]
    );
    ctx.orders[name] = r.rows[0].or_id;
  }
});

test.afterAll(async () => {
  if (!client) return;
  await client.query("DELETE FROM tbl_orders WHERE idempotency_key LIKE 'viewer-%'");
  await client.query("DELETE FROM tbl_users WHERE username LIKE 'viewer_%'");
  await client.end();
});

async function patch(request, orderId, status) {
  return request.patch(`${API}/orders/${orderId}/status`, {
    headers: { Authorization: `Bearer ${ctx.token}`, 'Content-Type': 'application/json' },
    data: { status },
  });
}

test('Viewer cannot move an order forward', async ({ request }) => {
  const res = await patch(request, ctx.orders.forward, 'Confirmed');
  expect(res.status()).toBe(403);
});

test('Viewer cannot cancel an order', async ({ request }) => {
  const res = await patch(request, ctx.orders.cancel, 'Cancelled');
  expect(res.status()).toBe(403);
});
