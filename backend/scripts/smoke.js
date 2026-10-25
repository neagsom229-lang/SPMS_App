require('dotenv').config();
const base = 'http://localhost:5000';
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
const show = (label, r) => console.log(label.padEnd(48), r.status, (typeof r.body === 'string' ? r.body : JSON.stringify(r.body)).slice(0, 120));

(async () => {
  console.log('=== RUNNING SMOKE TEST FOR ALL GET ROUTES WITHOUT PATH PARAMS ===');
  const routes = [
    '/health',
    '/api/db-test',
    '/api/activity-logs',
    '/api/analytics/monthly-revenue',
    '/api/analytics/stats',
    '/api/analytics/top-products',
    '/api/auth/test',
    '/api/auth/me',
    '/api/categories',
    '/api/customers',
    '/api/dashboard/low-stock',
    '/api/dashboard/pending',
    '/api/dashboard/recent',
    '/api/dashboard/sales-summary?range=30d',
    '/api/dashboard/stats',
    '/api/dashboard/system/stats',
    '/api/orders',
    '/api/orders/recent',
    '/api/payment/khqr',
    '/api/payment/admin/pending',
    '/api/payment/admin/all',
    '/api/products',
    '/api/public/store/demo-store',
    '/api/public/store/demo-store/categories',
    '/api/public/store/demo-store/menu',
    '/api/services',
    '/api/stock',
    '/api/stock/low-stock',
    '/api/suppliers',
    '/api/system/stats',
    '/api/tenants',
    '/api/tenants/system/stats',
    '/api/users',
    '/api/warranties'
  ];

  // First call public store routes without auth
  show('/api/public/store/demo-store', await call('GET', '/api/public/store/demo-store'));
  show('/api/public/store/demo-store/categories', await call('GET', '/api/public/store/demo-store/categories'));
  show('/api/public/store/demo-store/menu', await call('GET', '/api/public/store/demo-store/menu'));

  // Login as admin
  const adminUser = 'admin';
  const adminPass = 'Admin123!';
  let r = await call('POST', '/api/auth/login', { username: adminUser, password: adminPass });
  console.log('login'.padEnd(48), r.status, typeof r.body === 'object' ? 'success, token acquired' : r.body);
  const token = r.body && (r.body.token || r.body.accessToken || (r.body.data && r.body.data.token));
  if (!token) {
    console.log('❌ NO TOKEN FOUND - stop here');
    return;
  }

  const results = [];
  for (const p of routes) {
    if (p.startsWith('/api/public/')) continue; // already called
    const res = await call('GET', p, null, token);
    show(p, res);
    results.push({ endpoint: p, status: res.status });
  }

  console.log('\n=== SMOKE TEST SUMMARY TABLE ===');
  console.table(results);
})();
