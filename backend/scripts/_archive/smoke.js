require('./_guard.js');
require('dotenv').config();
const { Client } = require('pg');
const base = 'http://localhost:5000';

async function checkDb() {
  const client = new Client({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5433/spms_test' });
  await client.connect();
  const res = await client.query('SELECT current_database(), inet_server_addr(), inet_server_port();');
  console.table([res.rows[0]]);
  await client.end();
}
checkDb().catch(e => console.error('SMOKE_DB_ERROR:', e.message));
async function call(method, path, body, token) {
  try {
    const r = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': '4',
        ...(token ? { Authorization: 'Bearer ' + token } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const t = await r.text();
    let j;
    try { j = JSON.parse(t); } catch { j = t; }
    return { status: r.status, body: j };
  } catch (err) {
    return { status: 500, body: err.message };
  }
}

(async () => {
  console.log('=== SMOKE TEST STARTING ===');
  const results = [];

  // Health / Root
  const root = await call('GET', '/');
  results.push({ endpoint: '/', status: root.status });

  // Login admin
  const login = await call('POST', '/api/auth/login', { username: 'admin', password: 'password123' });
  const token = login.body?.token;
  results.push({ endpoint: '/api/auth/login', status: login.status });

  if (!token) {
    console.error('Smoke test login failed:', login);
    process.exit(1);
  }

  // Protected endpoints
  const endpoints = [
    '/api/orders',
    '/api/products',
    '/api/customers',
    '/api/suppliers',
    '/api/stock',
    '/api/categories',
    '/api/analytics',
    '/api/warranties',
    '/api/services'
  ];

  for (const p of endpoints) {
    const res = await call('GET', p, null, token);
    results.push({ endpoint: p, status: res.status });
  }

  console.log('\n=== SMOKE TEST SUMMARY TABLE ===');
  console.table(results);
})();
