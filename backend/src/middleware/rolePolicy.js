// backend/src/middleware/rolePolicy.js
// One place that decides which roles may call which management routes.
const { authenticate } = require('./auth');

const ADMIN_ROLES = ['admin', 'administrator', 'manager', 'owner'];
const WRITE = ['POST', 'PUT', 'PATCH', 'DELETE'];

// [methods or 'ANY', regex tested against the path after /api]
const ADMIN_ONLY = [
  ['ANY', /^\/users(\/|$)/],
  ['ANY', /^\/reports(\/|$)/],
  [WRITE, /^\/products(\/|$)/],
  [WRITE, /^\/categories(\/|$)/],
  [WRITE, /^\/suppliers(\/|$)/],
  [WRITE, /^\/stock(\/|$)/],
  [['POST', 'PUT', 'PATCH'], /^\/orders\/[^/]+\/(cancel|refund|status)(\/|$)/],
  [['GET'], /^\/dashboard\/sales-summary(\/|$)/],
  [['DELETE'], /^\/customers(\/|$)/]
];

function rolePolicy(req, res, next) {
  const rule = ADMIN_ONLY.find((r) => (r[0] === 'ANY' || r[0].includes(req.method)) && r[1].test(req.path));
  if (!rule) return next();
  authenticate(req, res, () => {
    if (req.user && req.user.isSuperAdmin) return next();
    const role = String((req.user && req.user.role) || '').toLowerCase();
    if (ADMIN_ROLES.includes(role)) return next();
    return res.status(403).json({ error: 'You do not have permission to do this' });
  });
}

module.exports = rolePolicy;