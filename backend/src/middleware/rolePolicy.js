// backend/src/middleware/rolePolicy.js
// One place that decides which roles may call which management routes.
const { authenticate } = require('./auth');

const ADMIN_ROLES = ['admin', 'administrator', 'manager', 'owner'];
const FORWARD_ORDER_ROLES = new Set([...ADMIN_ROLES, 'staff', 'cashier']);
const WRITE = ['POST', 'PUT', 'PATCH', 'DELETE'];

const normalizeRole = (user) => String(user?.role || '').trim().toLowerCase();

// Single source of truth for admin checks. Super Admin is always an admin;
// roles are case/whitespace insensitive.
function isAdminRole(user) {
  return !!(user && (user.isSuperAdmin || ADMIN_ROLES.includes(normalizeRole(user))));
}

function canMoveOrderForward(user) {
  return !!(user && FORWARD_ORDER_ROLES.has(normalizeRole(user))) || isAdminRole(user);
}

// [methods or 'ANY', regex tested against the path after /api with case-insensitivity flag 'i']
const ADMIN_ONLY = [
  ['ANY', /^\/users(\/|$)/i],
  ['ANY', /^\/reports(\/|$)/i],
  [WRITE, /^\/products(\/|$)/i],
  [WRITE, /^\/categories(\/|$)/i],
  [WRITE, /^\/suppliers(\/|$)/i],
  [WRITE, /^\/stock(\/|$)/i],
  [['POST', 'PUT'], /^\/orders\/[^/]+\/(cancel|refund)(\/|$)/i],
  [['DELETE'], /^\/orders\/[^/]+(\/|$)/i],
  [['GET'], /^\/dashboard\/sales-summary(\/|$)/i],
  [['DELETE'], /^\/customers(\/|$)/i]
];

function rolePolicy(req, res, next) {
  const rule = ADMIN_ONLY.find((r) => (r[0] === 'ANY' || r[0].includes(req.method)) && r[1].test(req.path));
  if (!rule) return next();
  authenticate(req, res, () => {
    if (isAdminRole(req.user)) return next();
    return res.status(403).json({ error: 'You do not have permission to do this' });
  });
}

module.exports = rolePolicy;
module.exports.isAdminRole = isAdminRole;
module.exports.canMoveOrderForward = canMoveOrderForward;
module.exports.ADMIN_ROLES = ADMIN_ROLES;
