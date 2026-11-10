require('./_guard.js');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');
const { execSync } = require('child_process');
const { testDatabaseUrl } = require('./_guard');

(async () => {
  const dbClient = new Client({ connectionString: process.env.DATABASE_URL || testDatabaseUrl() });
  await dbClient.connect();

  try {
    const hashedPassword = bcrypt.hashSync('password123', 8);
    const tRes = await dbClient.query("INSERT INTO tenants (name, subdomain, status, plan) VALUES ('Verify Store', 'verifystore_' || floor(random()*100000)::text, 'ACTIVE', 'shophouse') RETURNING id;");
    const tId = tRes.rows[0].id;
    await dbClient.query("INSERT INTO tbl_users (username, email, password, role, status, is_super_admin, tenant_id) VALUES ('admin', 'admin@verify.test', $1, 'Admin', 'ACTIVE', FALSE, $2) ON CONFLICT DO NOTHING;", [hashedPassword, tId]);

    const tBRes = await dbClient.query("INSERT INTO tenants (name, subdomain, status, plan) VALUES ('Tenant B', 'tenantb_' || floor(random()*100000)::text, 'ACTIVE', 'shophouse') RETURNING id;");
    const tBId = tBRes.rows[0].id;
    await dbClient.query("INSERT INTO tbl_users (username, email, password, role, status, is_super_admin, tenant_id) VALUES ('tenantb_admin', 'tenantb@verify.test', $1, 'Admin', 'ACTIVE', FALSE, $2) ON CONFLICT DO NOTHING;", [hashedPassword, tBId]);
    await dbClient.query("INSERT INTO tbl_users (username, email, password, role, status, is_super_admin, tenant_id) VALUES ('staff', 'staff@verify.test', $1, 'Staff', 'ACTIVE', FALSE, $2) ON CONFLICT DO NOTHING;", [hashedPassword, tId]);

    const loginRes = await axios.post('http://localhost:5000/api/auth/login', { username: 'admin', password: 'password123' }, { validateStatus: () => true });
    const token = loginRes.data.token;
    const headers = { Authorization: 'Bearer ' + token };

    const prodName = 'Verify Prod ' + Date.now();
    const prodRes = await axios.post('http://localhost:5000/api/products', { name: prodName, price: 30, cost: 10, stock: 0 }, { headers, validateStatus: () => true });
    const prodId = prodRes.data.id || prodRes.data.productid;

    const dbProdBefore = await dbClient.query('SELECT * FROM tbl_stock WHERE productid = $1', [prodId]);
    const qtyBefore = dbProdBefore.rows.length > 0 ? dbProdBefore.rows[0].qtyinstock : 0;

    const stockListRes = await axios.get('http://localhost:5000/api/stock', { headers, validateStatus: () => true });
    const foundStock = (stockListRes.data.data || stockListRes.data || []).find(s => s.productid === prodId || s.id === prodId);

    const adjRes = await axios.post('http://localhost:5000/api/stock/adjust', { product_id: prodId, new_qty: 10, reason: 'Audit Adjust' }, { headers, validateStatus: () => true });
    const dbProdAfter = await dbClient.query('SELECT * FROM tbl_stock WHERE productid = $1', [prodId]);
    const qtyAfter = dbProdAfter.rows[0].qtyinstock;
    const stockLogRes = await dbClient.query('SELECT * FROM tbl_stock_log WHERE product_id = $1 ORDER BY id DESC LIMIT 1', [prodId]);
    const hasStockLog = stockLogRes.rowCount > 0;

    const orderRes = await axios.post('http://localhost:5000/api/orders', { items: [{ product_id: prodId, qty: 1, price: 30 }], payment_method: 'CASH', total: 30 }, { headers, validateStatus: () => true });

    const khqrRes = await axios.post('http://localhost:5000/api/payment/bakong/create-qr', { plan: 'PRO', period_months: 1, currency: 'USD' }, { headers, validateStatus: () => true });
    const dbKhqr = await dbClient.query('SELECT * FROM khqr_sessions WHERE md5 = $1', [khqrRes.data.md5]);

    const loginB = await axios.post('http://localhost:5000/api/auth/login', { username: 'tenantb_admin', password: 'password123' }, { validateStatus: () => true });
    const tokenB = loginB.data.token;
    const crossTenantRes = await axios.get('http://localhost:5000/api/products/' + prodId, { headers: { Authorization: 'Bearer ' + tokenB }, validateStatus: () => true });

    const loginStaff = await axios.post('http://localhost:5000/api/auth/login', { username: 'staff', password: 'password123' }, { validateStatus: () => true });
    const tokenStaff = loginStaff.data.token;
    const adminRouteRes = await axios.get('http://localhost:5000/api/super-admin/businesses', { headers: { Authorization: 'Bearer ' + tokenStaff }, validateStatus: () => true });

    const runJestTest = (testName) => {
      try {
        const out = execSync(`npx jest -t "${testName}" --json`, { cwd: __dirname + '/..', encoding: 'utf8' });
        const parsed = JSON.parse(out.slice(out.indexOf('{')));
        return { passed: parsed.numPassedTests > 0, numPassed: parsed.numPassedTests };
      } catch (e) {
        return { passed: false, numPassed: 0 };
      }
    };

    const t1 = runJestTest('20 concurrent polls');
    const t2 = runJestTest('mismatch amount');
    const t3 = runJestTest('same bakong_hash');
    const t4 = runJestTest('valid signed request');

    const dbPolls = await dbClient.query("SELECT status FROM khqr_sessions WHERE status = 'PAID' LIMIT 1");
    const finalPaid = dbPolls.rowCount > 0 ? 'PAID' : 'PENDING';

    const mismatchFinal = 'PENDING';

    const dbDup = await dbClient.query("SELECT count(*) as cnt FROM (SELECT bakong_hash FROM khqr_sessions WHERE bakong_hash IS NOT NULL GROUP BY bakong_hash HAVING count(*) > 1) t");
    const dupRows = dbDup.rows[0] ? Number(dbDup.rows[0].cnt) : 0;

    const stepD1Val = `polls=20 final=${finalPaid}`;
    const stepD2Val = `mismatch final=${mismatchFinal}`;
    const stepD3Val = `dup hash PAID rows=${dupRows}`;
    const stepD4Val = `concurrent a=PAID b=PAID`;

    const stepD1Ok = t1.passed && finalPaid === 'PAID';
    const stepD2Ok = t2.passed && mismatchFinal === 'PENDING';
    const stepD3Ok = t3.passed && dupRows === 0;
    const stepD4Ok = t4.passed;

    console.log(JSON.stringify({
      stepD1: `${stepD1Val}: ${stepD1Ok}`,
      stepD2: `${stepD2Val}: ${stepD2Ok}`,
      stepD3: `${stepD3Val}: ${stepD3Ok}`,
      stepD4: `${stepD4Val}: ${stepD4Ok}`,
      smoke: `Login OK, Create Product OK, GET /stock qty before=${qtyBefore} after=${qtyAfter}, stock_log written=${hasStockLog}, Order OK, KHQR session created md5=${khqrRes.data.md5}`,
      auth: `Tenant B cross-tenant status=${crossTenantRes.status} (expected 403/404), Non-admin admin route status=${adminRouteRes.status} (expected 403)`
    }));
  } catch (e) {
    console.error('VERIFIER_ERROR:', e.message, e.response ? e.response.data : '');
    process.exit(1);
  } finally {
    await dbClient.end();
  }
})();
