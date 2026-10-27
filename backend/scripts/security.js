require('dotenv').config();
const crypto = require('crypto');
const BASE = 'http://localhost:5000/api';
let pass = 0;
let fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('PASS  ' + name); }
  else { fail++; console.log('FAIL  ' + name + '  -> ' + detail); }
}
async function api(method, path, body, token, extra) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  Object.assign(headers, extra || {});
  const r = await fetch(BASE + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { data = text; }
  return { status: r.status, data: data };
}
function short(r) { return r.status + ' ' + JSON.stringify(r.data).slice(0, 130); }
function rows(d) { return Array.isArray(d) ? d : ((d && (d.orders || d.data || d.rows || d.items)) || []); }
const uid = () => crypto.randomUUID();
const rnd = () => crypto.randomBytes(4).toString('hex');
const phone = (p) => p + Math.floor(1000000 + Math.random() * 8999999);

async function newTenant(label) {
  const sub = 'sec-' + label + '-' + rnd();
  const pw = 'Qa!' + crypto.randomBytes(8).toString('hex');
  const reg = await api('POST', '/auth/register-client', { businessName: sub, email: sub + '@test.com', password: pw, subdomain: sub });
  const login = await api('POST', '/auth/login', { username: sub + '_admin', password: pw });
  const token = (login.data && login.data.token) || (reg.data && reg.data.token) || null;
  return { sub: sub, token: token, reg: reg.status, login: login.status };
}

(async () => {
  const A = await newTenant('a');
  const B = await newTenant('b');
  if (!A.token || !B.token) {
    console.log('Could not create the test tenants (register/login: A ' + A.reg + '/' + A.login + ', B ' + B.reg + '/' + B.login + '). If you see 429, restart the backend and retry.');
    process.exit(1);
  }
  const cat = await api('POST', '/categories', { name: 'QA ' + rnd() }, A.token);
  const prod = await api('POST', '/products', { name: 'QA Item', barcode: 'QA-' + rnd(), cost: 1, price: 2, stock: 10, category_id: cat.data && cat.data.id }, A.token);
  const pid = prod.data && prod.data.id;
  check('admin can create a product', prod.status === 201 && !!pid, short(prod));
  if (!pid) { console.log('Cannot continue without a product.'); process.exit(1); }
  const cust = await api('POST', '/customers', { name: 'QA Customer', phone: phone('09') }, A.token);
  const custId = cust.data && cust.data.id;
  check('admin can create a customer', cust.status === 201 && !!custId, short(cust));

  console.log('--- roles ---');
  const cname = 'cashier_' + rnd();
  const cpw = 'Qa!' + crypto.randomBytes(8).toString('hex');
  const cc = await api('POST', '/users', { username: cname, password: cpw, role: 'cashier', fullname: 'QA Cashier', email: cname + '@test.com' }, A.token);
  check('admin can create a cashier', cc.status === 201, short(cc));
  const cl = await api('POST', '/auth/login', { username: cname, password: cpw });
  const CT = cl.data && cl.data.token;
  check('cashier can log in', !!CT, short(cl));
  if (!CT) { console.log('Cannot continue without the cashier token.'); process.exit(1); }
  const cUserId = cc.data && cc.data.user && (cc.data.user.userid || cc.data.user.id);

  const okList = await api('GET', '/products', null, CT);
  check('cashier can list products', okList.status === 200, short(okList));
  const sale = await api('POST', '/orders', { items: [{ product_id: pid, qty: 1 }], payment_method: 'Cash', idempotency_key: uid() }, CT);
  check('cashier can make a sale', sale.status === 201, short(sale));
  const orderId = sale.data && (sale.data.or_id || sale.data.id);
  const quick = await api('POST', '/customers', { name: 'Walk In', phone: phone('08') }, CT);
  check('cashier can add a customer', quick.status === 201, short(quick));

  const denied = [
    ['DELETE', '/products/' + pid, null],
    ['PUT', '/products/' + pid, { price: 1 }],
    ['POST', '/products', { name: 'Nope', price: 1 }],
    ['POST', '/categories', { name: 'Nope ' + rnd() }],
    ['POST', '/suppliers', { name: 'Nope' }],
    ['POST', '/stock/receive', { product_id: pid, qty: 5, reason: 'Purchase' }],
    ['POST', '/stock/adjust', { product_id: pid, new_qty: 999, reason: 'Correction' }],
    ['GET', '/users', null],
    ['POST', '/users', { username: 'evil_' + rnd(), password: 'Password1!', role: 'Admin', fullname: 'Evil', email: 'evil' + rnd() + '@test.com' }],
    ['PUT', '/users/' + cUserId, { role: 'Admin' }],
    ['GET', '/reports/export/products', null],
    ['GET', '/dashboard/sales-summary?range=30d', null],
    ['DELETE', '/customers/' + custId, null],
    ['POST', '/orders/' + orderId + '/cancel', {}],
    ['POST', '/orders/' + orderId + '/refund', {}]
  ];
  for (const d of denied) {
    const r = await api(d[0], d[1], d[2], CT);
    check('cashier is blocked: ' + d[0] + ' ' + d[1].split('?')[0], r.status === 403, short(r));
  }
  const still = await api('GET', '/products/' + pid, null, A.token);
  check('product untouched after the cashier attempts', still.status === 200 && Number(still.data.price) === 2 && String(still.data.status).toLowerCase() === 'active', short(still));

  console.log('--- tenant isolation ---');
  const meA = await api('GET', '/auth/me', null, A.token);
  const aTid = meA.data && meA.data.user && meA.data.user.tenantId;
  const bGet = await api('GET', '/products/' + pid, null, B.token);
  check('tenant B cannot read A product', bGet.status === 403 || bGet.status === 404, short(bGet));
  const bSpoof = await api('GET', '/products/' + pid, null, B.token, { 'x-tenant-id': String(aTid) });
  check('spoofed X-Tenant-Id header does not expose A data', bSpoof.status === 403 || bSpoof.status === 404, short(bSpoof));
  const bPut = await api('PUT', '/products/' + pid, { price: 0.01 }, B.token);
  check('tenant B cannot edit A product', bPut.status === 403 || bPut.status === 404, short(bPut));
  const bDel = await api('DELETE', '/products/' + pid, null, B.token);
  check('tenant B cannot delete A product', bDel.status === 403 || bDel.status === 404, short(bDel));
  const bSell = await api('POST', '/orders', { items: [{ product_id: pid, qty: 1 }], payment_method: 'Cash', idempotency_key: uid() }, B.token);
  check('tenant B cannot sell A product', bSell.status >= 400 && bSell.status < 500, short(bSell));
  const bCat = await api('POST', '/products', { name: 'Steal', price: 1, category_id: cat.data && cat.data.id }, B.token);
  check('tenant B cannot use A category', bCat.status >= 400 && bCat.status < 500, short(bCat));
  const bCust = await api('GET', '/customers', null, B.token);
  check('tenant B customer list excludes A customers', !rows(bCust.data).some((c) => c.id === custId), short(bCust));
  const bOrders = await api('GET', '/orders', null, B.token);
  check('tenant B order list excludes A orders', !rows(bOrders.data).some((o) => (o.or_id || o.id) === orderId), short(bOrders));
  const again = await api('GET', '/products/' + pid, null, A.token);
  check('A product price unchanged after all of that', Number(again.data.price) === 2, short(again));

  console.log('--- public menu ---');
  const menu = await api('GET', '/public/store/' + A.sub + '/menu');
  const items = (menu.data && menu.data.products) || [];
  check('public menu lists the new product', items.some((p) => p.id === pid), short(menu));
  const leak = items.length ? Object.keys(items[0]).filter((k) => /cost|buy|supplier/i.test(k)) : [];
  check('public menu hides cost and supplier fields', leak.length === 0, 'leaked: ' + leak.join(', '));

  console.log('--- last unit, 5 sales at the same time ---');
  const one = await api('POST', '/products', { name: 'Last Unit', barcode: 'LU-' + rnd(), cost: 1, price: 3, stock: 1 }, A.token);
  const oneId = one.data && one.data.id;
  const burst = await Promise.all([1, 2, 3, 4, 5].map(() => api('POST', '/orders', { items: [{ product_id: oneId, qty: 1 }], payment_method: 'Cash', idempotency_key: uid() }, A.token)));
  const codes = burst.map((r) => r.status).join(',');
  check('exactly one of 5 parallel sales wins', burst.filter((r) => r.status === 201).length === 1, codes);
  check('the other 4 are refused with 409', burst.filter((r) => r.status === 409).length === 4, codes);
  const after = await api('GET', '/products/' + oneId, null, A.token);
  check('stock ends at exactly 0, never negative', Number(after.data.stock) === 0, short(after));

  console.log('--- bad input and money safety ---');
  const base = { items: [{ product_id: pid, qty: 1 }], payment_method: 'Cash' };
  const bad = [
    ['quantity 0', { items: [{ product_id: pid, qty: 0 }], payment_method: 'Cash' }],
    ['negative quantity', { items: [{ product_id: pid, qty: -3 }], payment_method: 'Cash' }],
    ['fractional quantity', { items: [{ product_id: pid, qty: 1.5 }], payment_method: 'Cash' }],
    ['huge quantity', { items: [{ product_id: pid, qty: 1000000000 }], payment_method: 'Cash' }],
    ['text product id', { items: [{ product_id: 'abc', qty: 1 }], payment_method: 'Cash' }],
    ['no items', { items: [], payment_method: 'Cash' }],
    ['negative discount', Object.assign({}, base, { discount: -5 })],
    ['discount above the total', Object.assign({}, base, { discount: 999 })]
  ];
  for (const b of bad) {
    const r = await api('POST', '/orders', Object.assign({ idempotency_key: uid() }, b[1]), A.token);
    check('order rejected with 4xx, never 500: ' + b[0], r.status >= 400 && r.status < 500, short(r));
  }
  const negPrice = await api('POST', '/products', { name: 'Neg', price: -10, stock: 0 }, A.token);
  check('product with a negative price is rejected', negPrice.status === 400, short(negPrice));
  const negEdit = await api('PUT', '/products/' + pid, { price: -1 }, A.token);
  check('editing a price to a negative number is rejected', negEdit.status === 400, short(negEdit));

  console.log('\nRESULT: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('SCRIPT ERROR:', e.message); process.exit(1); });