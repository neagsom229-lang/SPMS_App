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
async function newTenant(label) {
  const sub = 'esc-' + label + '-' + rnd();
  const pw = 'Qa!' + crypto.randomBytes(8).toString('hex');
  const reg = const reg = await api('POST', '/auth/register-client', { businessName: sub, email: sub + '@test.com', password: pw, subdomain: sub });
  const login = await api('POST', '/auth/login', { username: sub + '_admin', password: pw });
  const token = login.data && login.data.token;
  const me = token ? await api('GET', '/auth/me', null, token) : { data: {} };
  const u = (me.data && me.data.user) || {};
  console.log('setup ' + label + ': register ' + reg.status + ' login ' + login.status + ' tenantId ' + u.tenantId + ' userId ' + u.id); console.log('setup ' + label + ': register ' + reg.status + ' login ' + login.status + ' tenantId ' + u.tenantId + ' userId ' + u.id); return { sub: sub, token: token, tid: u.tenantId, uid: u.id, adminName: sub + '_admin' };
}
(async () => {
  const A = await newTenant('a');
  const B = await newTenant('b');
  if (!A.token || !B.token || !A.tid || !B.tid) { console.log('Could not set up the tenants. If you see 429, restart the backend and retry.'); process.exit(1); }
  const mk = (extra) => { const n = 'u_' + rnd(); return Object.assign({ username: n, password: 'Qa!' + rnd() + rnd(), fullname: 'QA User', email: n + '@test.com', role: 'cashier' }, extra); };
  async function loginAs(u) {
    const l = await api('POST', '/auth/login', { username: u.username, password: u.password });
    const t = l.data && l.data.token;
    if (!t) return { token: null, me: {} };
    const me = await api('GET', '/auth/me', null, t);
    return { token: t, me: (me.data && me.data.user) || {} };
  }
  console.log('--- user creation limits ---');
  const cross = mk({ tenant_id: B.tid });
  const rc = await api('POST', '/users', cross, A.token);
  if (rc.status >= 400 && rc.status < 500) check('admin cannot create a user in another tenant (rejected)', true);
  else { const l = await loginAs(cross); check('user created with another tenant_id still lands in the admin tenant', l.me.tenantId === A.tid, short(rc) + ' | tenantId ' + l.me.tenantId); }
  const rs = await api('POST', '/users', mk({ role: 'Super Admin' }), A.token);
  check('admin cannot create a Super Admin', rs.status >= 400 && rs.status < 500, short(rs));
  const sa2 = mk({ role: 'Admin', is_super_admin: true });
  const rs2 = await api('POST', '/users', sa2, A.token);
  if (rs2.status === 201) { const l = await loginAs(sa2); check('is_super_admin in the body is ignored', l.me.isSuperAdmin === false, 'isSuperAdmin=' + l.me.isSuperAdmin); }
  else check('is_super_admin in the body is rejected', rs2.status >= 400 && rs2.status < 500, short(rs2));
  console.log('--- other tenants users ---');
  const list = await api('GET', '/users', null, A.token);
  const rows = Array.isArray(list.data) ? list.data : ((list.data && (list.data.users || list.data.data)) || []);
  check('user list of A does not include B users', !rows.some((x) => x.username === B.adminName), short(list));
  const put = await api('PUT', '/users/' + B.uid, mk({ fullname: 'hacked' }), A.token);
  check('A cannot edit a B user', put.status === 403 || put.status === 404, short(put));
  const del = await api('DELETE', '/users/' + B.uid, null, A.token);
  check('A cannot delete a B user', del.status === 403 || del.status === 404, short(del));
  const stillB = await api('POST', '/auth/login', { username: B.adminName, password: 'wrong-password' });
  check('B admin still exists after those attempts', stillB.status === 401, short(stillB));
  console.log('--- deactivated users ---');
  const c = mk({});
  const cr = await api('POST', '/users', c, A.token);
  const cid = cr.data && cr.data.user && (cr.data.user.userid || cr.data.user.id);
  const cl = await loginAs(c);
  check('new cashier can use the app', !!cl.token, short(cr));
  if (cl.token && cid) {
    const before = await api('GET', '/products', null, cl.token);
    check('cashier token works before deactivation', before.status === 200, short(before));
    const off = await api('PUT', '/users/' + cid, Object.assign({}, c, { status: 'INACTIVE' }), A.token);
    check('admin can deactivate the cashier', off.status === 200, short(off));
    const again = await api('POST', '/auth/login', { username: c.username, password: c.password });
    check('deactivated user cannot log in', again.status === 401 || again.status === 403, short(again));
    const old = await api('GET', '/products', null, cl.token);
    check('deactivated user old token is refused', old.status === 401 || old.status === 403, short(old));
  }
  console.log('\nRESULT: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('SCRIPT ERROR:', e.message); process.exit(1); });