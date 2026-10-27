require('dotenv').config();
const crypto = require('crypto');
const BASE = 'http://localhost:5000/api';
let pass = 0;
let fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('PASS  ' + name); }
  else { fail++; console.log('FAIL  ' + name + '  -> ' + detail); }
}
async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(BASE + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { data = text; }
  return { status: r.status, data: data };
}
const short = (r) => r.status + ' ' + JSON.stringify(r.data).slice(0, 140);
const rnd = () => crypto.randomBytes(4).toString('hex');
const uid = () => crypto.randomUUID();
function rows(d) { return Array.isArray(d) ? d : ((d && (d.orders || d.data || d.rows || d.items)) || []); }
function expect(name, r, codes) { check(name, [].concat(codes).includes(r.status), short(r)); }
async function newTenant(label) {
  const sub = 'oo-' + label + '-' + rnd();
  const pw = 'Qa!' + crypto.randomBytes(8).toString('hex');
  const reg = await api('POST', '/auth/register-client', { businessName: sub, email: sub + '@test.com', password: pw, subdomain: sub });
  const login = await api('POST', '/auth/login', { username: sub + '_admin', password: pw });
  return { sub: sub, token: login.data && login.data.token, reg: reg.status, login: login.status };
}
(async () => {
  const A = await newTenant('a');
  const B = await newTenant('b');
  if (!A.token || !B.token) { console.log('Could not set up the tenants (A ' + A.reg + '/' + A.login + ', B ' + B.reg + '/' + B.login + ').'); process.exit(1); }
  const prod = await api('POST', '/products', { name: 'OO Item', barcode: 'OO-' + rnd(), cost: 1, price: 2, stock: 5 }, A.token);
  const pid = prod.data && prod.data.id;
  check('admin can create a product', prod.status === 201 && !!pid, short(prod));
  if (!pid) { console.log('Cannot continue without a product.'); process.exit(1); }
  const stock = async () => { const r = await api('GET', '/products/' + pid, null, A.token); return r.data && Number(r.data.stock); };
  const expectStock = async (name, n) => { const s = await stock(); check(name, s === n, 'stock is ' + s + ', expected ' + n); };
  const summary = async () => (await api('GET', '/dashboard/sales-summary?range=30d', null, A.token)).data || {};
  const trackStatus = async (code) => { const r = await api('GET', '/public/orders/' + code); return r.data && r.data.order && r.data.order.status; };
  const expectTrack = async (name, code, want) => { const s = await trackStatus(code); check(name, s === want, 'status ' + s); };
  const patch = (id, status, token) => api('PATCH', '/orders/' + id + '/status', { status: status }, token || A.token);
  const place = (qty, extra) => api('POST', '/public/store/' + A.sub + '/orders', Object.assign({ items: [{ product_id: pid, qty: qty }], customer_name: 'Online Buyer', customer_phone: '012' + Math.floor(100000 + Math.random() * 899999), delivery_type: 'pickup', payment_method: 'Cash', idempotency_key: uid() }, extra || {}));

  console.log('--- placing an online order ---');
  const key1 = uid();
  const o1 = await place(2, { idempotency_key: key1 });
  const id1 = o1.data && o1.data.order_id;
  const code1 = o1.data && o1.data.tracking_code;
  const total1 = o1.data && Number(o1.data.total);
  check('online order is accepted', o1.status === 201 && !!id1 && !!code1, short(o1));
  await expectStock('stock dropped by the ordered quantity', 3);
  const dup = await place(2, { idempotency_key: key1 });
  check('same idempotency key returns the same order', (dup.status === 200 || dup.status === 201) && dup.data && dup.data.order_id === id1, short(dup));
  await expectStock('stock not reduced twice by the repeat', 3);
  const list = await api('GET', '/orders/online?status=Pending', null, A.token);
  check('staff can list pending online orders', list.status === 200 && rows(list.data).some((o) => (o.or_id || o.id) === id1 || o.tracking_code === code1), short(list));
  expect('staff can read the status counts', await api('GET', '/orders/online/count', null, A.token), 200);
  const s0 = await summary();
  check('dashboard shows 1 open online order', Number(s0.open_online_orders) === 1, 'open_online_orders=' + s0.open_online_orders);
  await expectTrack('customer tracking shows Pending', code1, 'Pending');

  console.log('--- status workflow ---');
  expect('unknown status is refused', await patch(id1, 'Banana'), 400);
  expect('cannot skip straight to Completed', await patch(id1, 'Completed'), 409);
  expect('Pending to Confirmed', await patch(id1, 'Confirmed'), 200);
  expect('Confirmed to Preparing', await patch(id1, 'Preparing'), 200);
  expect('Preparing to Ready', await patch(id1, 'Ready'), 200);
  expect('Ready to Completed', await patch(id1, 'Completed'), 200);
  expect('cannot move backwards from Completed', await patch(id1, 'Pending'), 409);
  expect('cannot cancel a Completed order', await patch(id1, 'Cancelled'), 409);
  await expectStock('stock unchanged by a Completed order', 3);
  await expectTrack('customer tracking shows Completed', code1, 'Completed');
  const s1 = await summary();
  check('completed online order counts as revenue', Number(s1.net_revenue) === total1, 'net_revenue=' + s1.net_revenue + ' order total=' + total1);
  check('open online orders back to 0', Number(s1.open_online_orders) === 0, 'open_online_orders=' + s1.open_online_orders);

  console.log('--- permissions and tenants ---');
  const o2 = await place(1);
  const id2 = o2.data && o2.data.order_id;
  const code2 = o2.data && o2.data.tracking_code;
  check('second online order accepted', o2.status === 201 && !!id2, short(o2));
  await expectStock('stock is 2 after the second order', 2);
  const cname = 'cashier_' + rnd();
  const cpw = 'Qa!' + crypto.randomBytes(8).toString('hex');
  await api('POST', '/users', { username: cname, password: cpw, role: 'cashier', fullname: 'OO Cashier', email: cname + '@test.com' }, A.token);
  const cl = await api('POST', '/auth/login', { username: cname, password: cpw });
  const CT = cl.data && cl.data.token;
  check('cashier can log in', !!CT, short(cl));
  if (CT) expect('cashier cannot change an online order status', await patch(id2, 'Confirmed', CT), 403);
  expect('tenant B cannot change the status of an A order', await patch(id2, 'Confirmed', B.token), [403, 404]);
  expect('tenant B cannot cancel an A order through the cancel route', await api('POST', '/orders/' + id2 + '/cancel', {}, B.token), [403, 404]);
  const bl = await api('GET', '/orders/online', null, B.token);
  check('tenant B online list excludes A orders', !rows(bl.data).some((o) => (o.or_id || o.id) === id1 || (o.or_id || o.id) === id2), short(bl));
  await expectTrack('order still Pending after those attempts', code2, 'Pending');

  console.log('--- cancelling ---');
  expect('admin cancels the order', await patch(id2, 'Cancelled'), 200);
  await expectStock('stock restored after the cancel', 3);
  expect('cancelling again is refused', await patch(id2, 'Cancelled'), 409);
  await expectStock('stock not restored twice (status route)', 3);
  expect('old cancel route refuses an already cancelled order', await api('POST', '/orders/' + id2 + '/cancel', {}, A.token), [400, 404, 409]);
  await expectStock('stock not restored twice (cancel route)', 3);
  expect('cannot reopen a cancelled order', await patch(id2, 'Confirmed'), 409);
  await expectTrack('customer tracking shows Cancelled', code2, 'Cancelled');

  console.log('--- bad online orders ---');
  expect('quantity above the stock is refused with 409', await place(999), 409);
  expect('quantity 0 is refused', await place(0), 400);
  expect('negative quantity is refused', await place(-1), 400);
  expect('fractional quantity is refused', await place(1.5), 400);
  expect('missing customer name is refused', await place(1, { customer_name: '' }), 400);
  expect('missing phone is refused', await place(1, { customer_phone: '' }), 400);
  expect('missing idempotency key is refused', await place(1, { idempotency_key: undefined }), 400);
  await expectStock('stock unchanged by refused orders', 3);
  const del = await api('DELETE', '/products/' + pid, null, A.token);
  expect('admin deactivates the product', del, [200, 204]);
  expect('an inactive product cannot be ordered online', await place(1), [400, 404, 409]);
  const menu = await api('GET', '/public/store/' + A.sub + '/menu');
  check('inactive product is gone from the public menu', !((menu.data && menu.data.products) || []).some((p) => p.id === pid), short(menu));

  console.log('\nRESULT: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('SCRIPT ERROR:', e.message); process.exit(1); });