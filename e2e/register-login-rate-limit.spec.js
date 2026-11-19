// Proposed regression test: repeated unique-tenant registrations must log in.
// New file only; no existing spec or production code is changed.
const { test, expect } = require('@playwright/test');
const { Client } = require('../backend/node_modules/pg');
const { testDatabaseUrl } = require('../backend/scripts/_guard');
const { API_URL } = require('../backend/scripts/e2e-ports');

const API = process.env.E2E_API_URL || API_URL;
const S = String(Date.now());
const PASSWORD = 'Qa!123456';
let client;

test.beforeAll(async () => {
  client = new Client({ connectionString: testDatabaseUrl() });
  await client.connect();
});

test.afterAll(async () => {
  if (!client) return;
  await client.query("DELETE FROM tbl_users WHERE username LIKE $1", [`rlt${S}%`]);
  await client.query("DELETE FROM tenants WHERE subdomain LIKE $1", [`rlt${S}%`]);
  await client.end();
});

test('25 unique tenant registrations each log in successfully', async ({ request }) => {
  const failures = [];
  for (let i = 1; i <= 25; i += 1) {
    const subdomain = `rlt${S}${i}`;
    const reg = await request.post(`${API}/auth/register-client`, {
      data: { businessName: `RLT ${i}`, email: `${subdomain}@test.com`, password: PASSWORD, subdomain },
    });
    if (!reg.ok()) {
      failures.push({ i, register: reg.status(), body: await reg.text() });
      continue;
    }
    const login = await request.post(`${API}/auth/login`, {
      data: { username: `${subdomain}_admin`, password: PASSWORD },
    });
    if (!login.ok()) failures.push({ i, login: login.status(), body: await login.text() });
  }
  expect(failures, JSON.stringify(failures)).toEqual([]);
});
