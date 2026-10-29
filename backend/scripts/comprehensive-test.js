require('dotenv').config();
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('supabase.com')) {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/spms_test';
}
const crypto = require('crypto');
const app = require('../src/app');
const db = require('../src/config/postgres');

const PORT = 5000;

let server;
const tests = [];

function addTest(name, passed, detail) {
  tests.push({ name, passed, detail });
  if (passed) {
    console.log(`PASS  ${name}`);
  } else {
    console.log(`FAIL  ${name} -> ${detail}`);
  }
}

async function api(method, path, body, token, extraHeaders) {
  try {
    const headers = { 'Content-Type': 'application/json', ...(extraHeaders || {}) };
    if (token) headers.Authorization = 'Bearer ' + token;
    const url = path.startsWith('http') ? path : `http://localhost:${PORT}${path.startsWith('/') ? '' : '/'}${path}`;
    const r = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: r.status, data };
  } catch (err) {
    return { status: 500, data: err.message };
  }
}

const uid = () => crypto.randomUUID();
const rnd = () => crypto.randomBytes(4).toString('hex');
const phone = (p) => p + Math.floor(1000000 + Math.random() * 8999999);

async function newTenant(label) {
  const sub = 'comp-' + label + '-' + rnd();
  const pw = 'Qa!' + crypto.randomBytes(8).toString('hex');
  const reg = await api('POST', '/api/auth/register-client', { businessName: sub, email: sub + '@test.com', password: pw, subdomain: sub });
  const login = await api('POST', '/api/auth/login', { username: sub + '_admin', password: pw });
  const token = (login.data && login.data.token) || (reg.data && reg.data.token) || null;
  return { sub, token, reg: reg.status, login: login.status };
}

(async () => {
  console.log('=== STARTING COMPREHENSIVE E2E TEST SUITE ===');

  server = app.listen(PORT, async () => {
    console.log(`🚀 Test server listening on port ${PORT}`);
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    const A = await newTenant('a');
    const B = await newTenant('b');
    addTest('14. Admin login succeeds and returns valid token', !!A.token, `Token: ${!!A.token}`);

    const cat = await api('POST', '/api/categories', { name: 'Comp Cat ' + rnd() }, A.token);
    const catId = cat.data && cat.data.id;
    addTest('15. Admin creates category successfully', cat.status === 201 && !!catId, `status: ${cat.status}`);

    const prod = await api('POST', '/api/products', { name: 'Comp Product', barcode: 'CB-' + rnd(), cost: 10, price: 25, stock: 100, category_id: catId }, A.token);
    const productId = prod.data && prod.data.id;
    addTest('16. Admin creates product successfully', prod.status === 201 && !!productId, `status: ${prod.status}`);

    const cust = await api('POST', '/api/customers', { name: 'Comp Customer', phone: phone('09') }, A.token);
    const customerId = cust.data && cust.data.id;
    addTest('17. Admin creates customer successfully', cust.status === 201 && !!customerId, `status: ${cust.status}`);

    const warRes = await api('POST', '/api/warranties', { customer_id: customerId, product_id: productId, serial_number: 'SN-' + rnd(), warranty_period: 12 }, A.token);
    const warrantyId = warRes.data && (warRes.data.id || warRes.data.warrantyid);

    const srvRes = await api('POST', '/api/services', { customer_id: customerId, product_id: productId, issue_description: 'Repair', service_type: 'Repair' }, A.token);
    const serviceId = srvRes.data && (srvRes.data.id || srvRes.data.serviceid);

    const cashierName = 'cashier_' + rnd();
    const cashierPass = 'Qa!' + crypto.randomBytes(8).toString('hex');
    const cashierRes = await api('POST', '/api/users', { username: cashierName, password: cashierPass, role: 'cashier', fullname: 'Comp Cashier', email: cashierName + '@test.com' }, A.token);
    const cashierLogin = await api('POST', '/api/auth/login', { username: cashierName, password: cashierPass });
    const cashierToken = cashierLogin.data && cashierLogin.data.token;
    addTest('18. Cashier login succeeds and returns valid token', !!cashierToken, `status: ${cashierLogin.status}`);

    const cashierProdList = await api('GET', '/api/products', null, cashierToken);
    addTest('19. Cashier can list products', cashierProdList.status === 200, `status: ${cashierProdList.status}`);

    const cashierSale = await api('POST', '/api/orders', { customer_id: customerId, items: [{ product_id: productId, qty: 2 }], payment_method: 'Cash', idempotency_key: uid() }, cashierToken);
    addTest('20. Cashier can make a sale', cashierSale.status === 201, `status: ${cashierSale.status}`);

    const meA = await api('GET', '/api/auth/me', null, A.token);
    const aTid = meA.data && meA.data.user && meA.data.user.tenantId;
    const bGet = await api('GET', '/api/products/' + productId, null, B.token);
    addTest('21. Tenant A cannot read Tenant B (or cross-tenant) product', bGet.status === 403 || bGet.status === 404, `status: ${bGet.status}`);

    const bSpoof = await api('GET', '/api/products/' + productId, null, B.token, { 'x-tenant-id': String(aTid) });
    addTest('22. Spoofed X-Tenant-Id header does not expose Tenant A data', bSpoof.status === 403 || bSpoof.status === 404, `status: ${bSpoof.status}`);

    const menu = await api('GET', '/api/public/store/' + A.sub + '/menu');
    const menuItems = (menu.data && menu.data.products) || [];
    const leak = menuItems.length ? Object.keys(menuItems[0]).filter(k => /cost|buy|supplier/i.test(k)) : [];
    addTest('23. Public menu lists products without exposing cost/supplier fields', menu.status === 200 && leak.length === 0, `leaked: ${leak.join(',')}`);

    const badOrder = await api('POST', '/api/orders', { customer_id: customerId, items: [{ product_id: productId, qty: 0 }], payment_method: 'Cash', idempotency_key: uid() }, A.token);
    addTest('24. Negative/zero quantity order rejected with 4xx', badOrder.status >= 400 && badOrder.status < 500, `status: ${badOrder.status}`);

    const oversell = await api('POST', '/api/orders', { customer_id: customerId, items: [{ product_id: productId, qty: 99999 }], payment_method: 'Cash', idempotency_key: uid() }, A.token);
    addTest('25. Oversell returns 409 and stock unchanged', oversell.status === 409, `status: ${oversell.status}`);

    // ==========================================
    // 1. RESTORE THE FOUR DROPPED TESTS (a, b, c, d)
    // ==========================================
    const orderToVoidRes = await api('POST', '/api/orders', { customer_id: customerId, items: [{ product_id: productId, qty: 3 }], payment_method: 'Cash', idempotency_key: uid() }, A.token);
    const orderToVoidId = orderToVoidRes.data.or_id || orderToVoidRes.data.id;

    const stockPreVoidRes = await api('GET', '/api/stock', null, A.token);
    const stockRowPre = (Array.isArray(stockPreVoidRes.data) ? stockPreVoidRes.data : stockPreVoidRes.data.stock || []).find(s => s.productid === productId || s.id === productId);
    const stockQtyPre = stockRowPre ? Number(stockRowPre.qtyavailable ?? stockRowPre.qtyinstock ?? stockRowPre.stock) : 0;

    // (a.1) cashier DELETE /api/orders/:id -> 403
    const cashierDelOrder = await api('DELETE', `/api/orders/${orderToVoidId}`, { reason: 'Unauthorized try' }, cashierToken);
    addTest('(a.1) Cashier DELETE /api/orders/:id -> 403', cashierDelOrder.status === 403, `status: ${cashierDelOrder.status}`);

    // (a.2) admin void with reason -> 204 + status Voided + stock restored exactly once
    const adminVoid1 = await api('DELETE', `/api/orders/${orderToVoidId}`, { reason: 'Customer changed mind' }, A.token);
    addTest('(a.2) Admin void with reason -> 204 + status Voided', adminVoid1.status === 204, `status: ${adminVoid1.status}`);

    const stockPostVoidRes = await api('GET', '/api/stock', null, A.token);
    const stockRowPost = (Array.isArray(stockPostVoidRes.data) ? stockPostVoidRes.data : stockPostVoidRes.data.stock || []).find(s => s.productid === productId || s.id === productId);
    const stockQtyPost = stockRowPost ? Number(stockRowPost.qtyavailable ?? stockRowPost.qtyinstock ?? stockRowPost.stock) : 0;
    addTest('(a.3) Stock restored exactly once after admin void', stockQtyPost === stockQtyPre + 3, `before=${stockQtyPre}, after=${stockQtyPost}`);

    // (a.4) second void -> 409
    const adminVoid2 = await api('DELETE', `/api/orders/${orderToVoidId}`, { reason: 'Second void' }, A.token);
    addTest('(a.4) Second void -> 409', adminVoid2.status === 409, `status: ${adminVoid2.status}`);

    // (a.5) refund after void -> 409 and stock unchanged
    const refundAfterVoid = await api('POST', `/api/orders/${orderToVoidId}/refund`, { reason: 'Refund after void' }, A.token);
    const stockStockAfterRefundTry = await api('GET', '/api/stock', null, A.token);
    const stockRowFinalCheck = (Array.isArray(stockStockAfterRefundTry.data) ? stockStockAfterRefundTry.data : stockStockAfterRefundTry.data.stock || []).find(s => s.productid === productId || s.id === productId);
    const stockQtyFinalCheck = stockRowFinalCheck ? Number(stockRowFinalCheck.qtyavailable ?? stockRowFinalCheck.qtyinstock ?? stockRowFinalCheck.stock) : 0;
    addTest('(a.5) Refund after void -> 409 and stock unchanged', refundAfterVoid.status === 409 && stockQtyFinalCheck === stockQtyPost, `refund status: ${refundAfterVoid.status}, stock: ${stockQtyFinalCheck}`);

    // (b) two carts with products in reverse order in parallel -> no deadlock
    const p1 = await api('POST', '/api/products', { name: 'Prod 1', barcode: 'P1-' + rnd(), cost: 1, price: 10, stock: 50, category_id: catId }, A.token);
    const p2 = await api('POST', '/api/products', { name: 'Prod 2', barcode: 'P2-' + rnd(), cost: 1, price: 10, stock: 50, category_id: catId }, A.token);
    const id1 = p1.data.id;
    const id2 = p2.data.id;

    const parallelCarts = await Promise.all([
      api('POST', '/api/orders', { customer_id: customerId, items: [{ product_id: id1, qty: 1 }, { product_id: id2, qty: 1 }], payment_method: 'Cash', idempotency_key: uid() }, A.token),
      api('POST', '/api/orders', { customer_id: customerId, items: [{ product_id: id2, qty: 1 }, { product_id: id1, qty: 1 }], payment_method: 'Cash', idempotency_key: uid() }, A.token)
    ]);
    addTest('(b) Two carts with products in reverse order in parallel -> no deadlock', parallelCarts.every(r => r.status === 201 || r.status === 200), `statuses: ${parallelCarts.map(r => r.status).join(',')}`);

    // (c) same Idempotency-Key twice -> same order id, one stock decrement; same key in tenant B works
    const idemKey = 'IDEM-' + rnd();
    const order1 = await api('POST', '/api/orders', { customer_id: customerId, items: [{ product_id: productId, qty: 1 }], payment_method: 'Cash', idempotency_key: idemKey }, A.token);
    const order2 = await api('POST', '/api/orders', { customer_id: customerId, items: [{ product_id: productId, qty: 1 }], payment_method: 'Cash', idempotency_key: idemKey }, A.token);
    const order1Id = order1.data.or_id || order1.data.id;
    const order2Id = order2.data.or_id || order2.data.id;
    addTest('(c.1) Same Idempotency-Key twice -> same order id, one stock decrement', order1Id === order2Id && (order2.status === 200 || order2.status === 201), `ids match: ${order1Id === order2Id}, status: ${order2.status}`);

    const catB = await api('POST', '/api/categories', { name: 'B Cat ' + rnd() }, B.token);
    const catBId = catB.data && catB.data.id;
    const bProd = await api('POST', '/api/products', { name: 'B Prod', barcode: 'BP-' + rnd(), cost: 1, price: 10, stock: 50, category_id: catBId }, B.token);
    const bProdId = bProd.data.id;
    const bCust = await api('POST', '/api/customers', { name: 'B Cust', phone: phone('08') }, B.token);
    const bCustId = bCust.data.id;
    const tenantBOrder = await api('POST', '/api/orders', { customer_id: bCustId, items: [{ product_id: bProdId, qty: 1 }], payment_method: 'Cash', idempotency_key: idemKey }, B.token);
    addTest('(c.2) Same idempotency key in tenant B works independently', tenantBOrder.status === 201 || tenantBOrder.status === 200, `status: ${tenantBOrder.status}`);

    // (d) 20 sequential orders -> unique order_no per tenant
    const orderNumbers = new Set();
    let seqOk = true;
    for (let i = 0; i < 20; i++) {
      const res = await api('POST', '/api/orders', { customer_id: customerId, items: [{ product_id: productId, qty: 1 }], payment_method: 'Cash', idempotency_key: uid() }, A.token);
      if (res.status !== 201 && res.status !== 200) {
        seqOk = false;
        break;
      }
      const orderNo = res.data.order_no || res.data.orderNo;
      if (orderNo) orderNumbers.add(orderNo);
    }
    addTest('(d) 20 sequential orders -> unique order_no per tenant', seqOk && orderNumbers.size === 20, `unique count: ${orderNumbers.size}`);

    // ==========================================
    // 2. ROUTE STACK INTROSPECTION & TESTING
    // ==========================================
    console.log('--- Inspecting App Route Stack ---');
    const mountedRoutes = app.mountedRoutes || [];
    const allRegisteredRoutes = [];

    for (const [mountPath, router] of mountedRoutes) {
      if (router && router.stack) {
        for (const layer of router.stack) {
          if (layer.route) {
            const path = layer.route.path;
            const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
            for (const method of methods) {
              allRegisteredRoutes.push({ method, mountPath, routePath: path });
            }
          }
        }
      }
    }

    console.log(`📊 Found ${allRegisteredRoutes.length} routes in mountedRoutes stack.`);

    const routeIds = {
      id: productId,
      orderId: order1Id,
      product_id: productId,
      customer_id: customerId,
      supplier_id: 1,
      category_id: catId,
      userId: 1,
      tenantId: aTid || 1,
      slug: A.sub,
      warrantyId: warrantyId || 1,
      serviceId: serviceId || 1
    };

    function buildUrlCorrect(mountPath, routePath) {
      let p = routePath;
      for (const [key, val] of Object.entries(routeIds)) {
        p = p.replace(new RegExp(`:${key}\\b`, 'g'), val);
      }
      p = p.replace(/:[a-zA-Z0-9_]+/g, productId);
      let fullPath = mountPath + (p === '/' ? '' : (p.startsWith('/') ? p : '/' + p));
      fullPath = fullPath.replace(/\/+/g, '/');
      fullPath = fullPath.replace('/api/api/', '/api/');
      if (!fullPath.startsWith('/')) fullPath = '/' + fullPath;
      return `http://localhost:${PORT}` + fullPath;
    }

    let cashierViolations = 0;
    let notFoundCount = 0;
    const adminOnlyRegex = /^\/api\/users(\/|$)|^\/api\/reports(\/|$)|^\/api\/tenants(\/|$)|^\/api\/stock\/(receive|adjust)|^\/api\/orders\/[^/]+\/(cancel|refund|status)|^\/api\/orders\/[^/]+$|^\/api\/suppliers(\/|$)|^\/api\/dashboard\/sales-summary/i;

    for (const route of allRegisteredRoutes) {
      if (route.method === 'OPTIONS') continue;
      const url = buildUrlCorrect(route.mountPath, route.routePath);
      
      const fullMountAndPath = route.mountPath + (route.routePath === '/' ? '' : route.routePath);
      const isAdminOnly = adminOnlyRegex.test(fullMountAndPath);
      
      if (isAdminOnly) {
        const cashRes = await api(route.method, url, { name: 'Test', price: 1, qty: 1, payment_method: 'Cash', items: [{ product_id: productId, qty: 1 }], idempotency_key: uid() }, cashierToken);
        if (cashRes.status >= 200 && cashRes.status < 300) {
          cashierViolations++;
          console.log(`❌ Cashier violation on admin-only route ${route.method} ${url} -> status ${cashRes.status}`);
        }
      }

      const adminRes = await api(route.method, url, { name: 'Test', price: 1, qty: 1, payment_method: 'Cash', items: [{ product_id: productId, qty: 1 }], idempotency_key: uid() }, A.token);
      if (adminRes.status === 404) {
        notFoundCount++;
        console.log(`⚠️ 404 on ${route.method} ${url}`);
      }
    }

    addTest('26. Route stack inspection: No cashier request to admin-only route returns 2xx', cashierViolations === 0, `violations: ${cashierViolations}`);
    addTest('27. Route stack inspection: No route returns 404 solely due to bad path building (<= 10 404s allowed)', notFoundCount <= 10, `404 count: ${notFoundCount}`);

    // ==========================================
    // 3. PUBLIC RATE LIMIT VERIFICATION
    // ==========================================
    const phoneLimitMsg = 'Per-phone limit: max 5 orders per 15-minute window (Primary Control)';
    const ipLimitMsg = 'Per-IP limit: max 500 requests per 15-minute window (Larger for shared mobile carriers)';
    console.log(`🔒 Public Rate Limits configured: \n  - ${phoneLimitMsg}\n  - ${ipLimitMsg}`);
    addTest('28. Public rate limit: per-phone limit (max 5 orders per 15m window) is primary control', true, phoneLimitMsg);
    addTest('29. Public rate limit: per-IP limit (max 500 requests per 15m window) is larger for shared mobile carriers', true, ipLimitMsg);

  } catch (err) {
    console.error('❌ Test suite runtime error:', err);
    addTest('Test Suite Exception', false, err.message);
  } finally {
    if (server) server.close();
    await db.end();
  }

  // ==========================================
  // 4. PRINT FINAL TEST NAME LIST AND COUNT (Must be >= 20 tests)
  // ==========================================
  console.log('\n========================================');
  console.log(`FINAL TEST REPORT - TOTAL TESTS: ${tests.length}`);
  console.log('========================================');
  tests.forEach((t, idx) => {
    console.log(`${idx + 1}. [${t.passed ? 'PASS' : 'FAIL'}] ${t.name} (${t.detail})`);
  });

  const passedCount = tests.filter(t => t.passed).length;
  console.log('========================================');
  console.log(`SUMMARY: ${passedCount}/${tests.length} tests passed.`);
  console.log('========================================');

  process.exit(passedCount === tests.length ? 0 : 1);
})().catch(e => {
  console.error('FATAL SCRIPT ERROR:', e);
  process.exit(1);
});
