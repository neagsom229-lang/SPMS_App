require('dotenv').config();
const base = 'http://localhost:5000';

async function call(method, path, body, token) {
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
}

(async () => {
  const adminPass = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';
  const loginRes = await call('POST', '/api/auth/login', { username: 'admin', password: adminPass });
  const token = loginRes.body && (loginRes.body.token || loginRes.body.accessToken || (loginRes.body.data && loginRes.body.data.token));
  if (!token) {
    console.error('❌ Login failed:', loginRes.body);
    process.exit(1);
  }
  console.log('✅ Admin logged in');

  for (const rng of ['30d', 'today']) {
    console.log(`\n=== RANGE: ${rng} ===`);
    const res = await call('GET', `/api/dashboard/sales-summary?range=${rng}`, null, token);
    if (res.status === 200) {
      const b = res.body;
      console.log('Keys:', Object.keys(b));
      console.log('refunds:', b.refunds);
      console.log('previous structure:', b.previous);
      console.log('change_pct structure:', b.change_pct);
      console.log('timeseries sample:', b.timeseries?.[0]);
      console.log('by_category sample:', b.by_category?.[0]);
      console.log('by_payment_method sample:', b.by_payment_method?.[0]);
      console.log('by_source sample:', b.by_source?.[0]);
      console.log('top_products sample:', b.top_products?.[0]);
      console.log('alerts sample:', b.alerts?.[0]);
    } else {
      console.log('Error:', res.status, res.body);
    }
  }
  process.exit(0);
})();
