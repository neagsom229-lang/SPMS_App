// New tests: every successful PATCH /orders/:id/status writes one audit row.
// No existing test is edited.
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

async function user(role, tenantId) {
  const uname = `aud_${role.replace(/\W/g, '')}_${SUFFIX}_${Math.random().toString(16).slice(2)}`.toLowerCase();
  await client.query(
    `INSERT INTO tbl_users (username,email,password,fullname,role,status,tenant_id,must_change_password)
     VALUES ($1,$2,$3,$4,$5,'ACTIVE',$6,FALSE)`,
    [uname, `${uname}@e2e.test`, bcrypt.hashSync('Test1234!', 10), uname, role, tenantId]
  );
  const id = (await client.query('SELECT userid FROM tbl_users WHERE username=$1', [uname])).rows[0].userid;
  return {
    id,
    token: jwt.sign({ userId: id, username: uname, role, tenantId, isSuperAdmin: false }, SECRET, { expiresIn: '1h' }),
  };
}

async function order(tenantId, customerId, status) {
  const r = await client.query(
    `INSERT INTO tbl_orders (tenant_id, customer_id, total, payment_method, status, order_no, idempotency_key)
     VALUES ($1,$2,20,'Cash',$3,$4,$5) RETURNING or_id`,
    [tenantId, customerId, status, `AUD-${SUFFIX}-${Math.random().toString(16).slice(2)}`, `aud-${SUFFIX}-${Math.random().toString(16).slice(2)}`]
  );
  return r.rows[0].or_id;
}

async function logs(orderId) {
  const r = await client.query('SELECT * FROM tbl_activity_logs WHERE target_table=$1 AND target_id=$2 ORDER BY id', ['tbl_orders', orderId]);
  return r.rows;
}

function patch(request, token, orderId, status) {
  return request.patch(`${API}/orders/${orderId}/status`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { status },
  });
}

test.beforeAll(async () => {
  const url = testDatabaseUrl();
  const parsed = new URL(url);
  if (parsed.port !== '15432' || !parsed.pathname.endsWith('_test')) {
    throw new Error(`refusing to run: DB target is ${parsed.hostname}:${parsed.port}${parsed.pathname}`);
  }
  client = new Client({ connectionString: url });
  await client.connect();
  await client.query("DELETE FROM tbl_activity_logs WHERE target_table='tbl_orders' AND target_id IN (SELECT or_id FROM tbl_orders WHERE idempotency_key LIKE 'aud-%')");
  await client.query("DELETE FROM tbl_orders WHERE idempotency_key LIKE 'aud-%'");
  await client.query("DELETE FROM tbl_users WHERE username LIKE 'aud_%'");

  const a = await client.query("SELECT id FROM tenants WHERE subdomain='demo'");
  ctx.tenantA = a.rows[0].id;
  const b = await client.query(
    `INSERT INTO tenants (name, subdomain, status, plan) VALUES ($1,$2,'ACTIVE','shophouse') RETURNING id`,
    [`Audit B ${SUFFIX}`, `aud-b-${SUFFIX}`]
  );
  ctx.tenantB = b.rows[0].id;
  const cust = await client.query('SELECT id FROM tbl_customers WHERE tenant_id=$1 LIMIT 1', [ctx.tenantA]);
  ctx.customer = cust.rows[0].id;
  const custB = await client.query(
    `INSERT INTO tbl_customers (cus_id,name,phone,tenant_id) VALUES ($1,$2,$3,$4) RETURNING id`,
    [`AUD-B-${SUFFIX}`, 'Audit B', `AUDB${SUFFIX}`, ctx.tenantB]
  );
  ctx.customerB = custB.rows[0].id;
  ctx.staff = await user('Staff', ctx.tenantA);
  ctx.admin = await user('Admin', ctx.tenantA);
  ctx.viewer = await user('Viewer', ctx.tenantA);
  ctx.adminB = await user('Admin', ctx.tenantB);
  ctx.orders = {
    forward: await order(ctx.tenantA, ctx.customer, 'Pending'),
    cancel: await order(ctx.tenantA, ctx.customer, 'Pending'),
    forbidden: await order(ctx.tenantA, ctx.customer, 'Pending'),
    conflict: await order(ctx.tenantA, ctx.customer, 'Completed'),
    crossTenant: await order(ctx.tenantA, ctx.customer, 'Pending'),
    crossTenantVisible: await order(ctx.tenantA, ctx.customer, 'Confirmed'),
  };
});

test.afterAll(async () => {
  if (!client) return;
  await client.query("DELETE FROM tbl_activity_logs WHERE target_table='tbl_orders' AND target_id IN (SELECT or_id FROM tbl_orders WHERE idempotency_key LIKE 'aud-%')");
  await client.query("DELETE FROM tbl_orders WHERE idempotency_key LIKE 'aud-%'");
  await client.query("DELETE FROM tbl_users WHERE username LIKE 'aud_%'");
  await client.query("DELETE FROM tbl_customers WHERE cus_id LIKE 'AUD-B-%'");
  await client.query("DELETE FROM tenants WHERE subdomain LIKE 'aud-b-%'");
  await client.end();
});

test('Staff forward move writes one row with from/to/user/tenant', async ({ request }) => {
  const res = await patch(request, ctx.staff.token, ctx.orders.forward, 'Confirmed');
  expect(res.status()).toBe(200);
  const rows = await logs(ctx.orders.forward);
  expect(rows.length).toBe(1);
  expect(rows[0].user_id).toBe(ctx.staff.id);
  expect(rows[0].tenant_id).toBe(ctx.tenantA);
  expect(rows[0].details).toContain('from=Pending');
  expect(rows[0].details).toContain('to=Confirmed');
  expect(rows[0].details).not.toMatch(/token|Bearer|password/i);
});

test('Admin cancel writes exactly one row', async ({ request }) => {
  const res = await patch(request, ctx.admin.token, ctx.orders.cancel, 'Cancelled');
  expect(res.status()).toBe(200);
  expect((await logs(ctx.orders.cancel)).length).toBe(1);
});

test('403 attempt writes no row', async ({ request }) => {
  const res = await patch(request, ctx.viewer.token, ctx.orders.forbidden, 'Confirmed');
  expect(res.status()).toBe(403);
  expect((await logs(ctx.orders.forbidden)).length).toBe(0);
});

test('409 attempt writes no row', async ({ request }) => {
  const res = await patch(request, ctx.admin.token, ctx.orders.conflict, 'Cancelled');
  expect(res.status()).toBe(409);
  expect((await logs(ctx.orders.conflict)).length).toBe(0);
});

test('tenant B cannot see tenant A activity rows', async ({ request }) => {
  const res = await request.get(`${API}/activity-logs?limit=200`, { headers: { Authorization: `Bearer ${ctx.adminB.token}` } });
  expect(res.status()).toBe(200);
  const body = await res.json();
  const ids = body.map((r) => r.target_id);
  expect(ids).not.toContain(ctx.orders.crossTenantVisible);
});

test('Viewer GET activity-logs stays 403', async ({ request }) => {
  const res = await request.get(`${API}/activity-logs`, { headers: { Authorization: `Bearer ${ctx.viewer.token}` } });
  expect(res.status()).toBe(403);
});
