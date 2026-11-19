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

function isViewerRole(user) {
  return !!user && normalizeRole(user) === 'viewer';
}

function isStaffOrAdminRole(user) {
  return isAdminRole(user) || normalizeRole(user) === 'staff';
}

function isKnownWriteRole(user) {
  return isAdminRole(user) || ['staff', 'cashier'].includes(normalizeRole(user));
}

// Public/auth endpoints must stay reachable without a tenant write role.
const AUTH_WRITE_EXCEPTIONS = /^\/auth\/(login|register-client|logout|profile|change-password)(\/|$)/i;
const PUBLIC_PREFIX = /^\/public(\/|$)/i;

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
  const writeGate = WRITE.includes(req.method)
    && !AUTH_WRITE_EXCEPTIONS.test(req.path)
    && !PUBLIC_PREFIX.test(req.path);
  const adminRule = ADMIN_ONLY.find((r) => (r[0] === 'ANY' || r[0].includes(req.method)) && r[1].test(req.path));
  if (!writeGate && !adminRule) return next();

  authenticate(req, res, () => {
    // Viewers are read-only on tenant routes; unknown roles fail closed on writes.
    // Forward order moves are the only non-admin write exception (Batch B).
    if (writeGate) {
      if (isViewerRole(req.user)) {
        return res.status(403).json({ error: 'Viewers are read-only' });
      }
      const forwardPatch = req.method === 'PATCH'
        && /^\/orders\/[^/]+\/status(\/|$)/i.test(req.path)
        && canMoveOrderForward(req.user);
      if (forwardPatch) return next();
      if (!isKnownWriteRole(req.user)) {
        return res.status(403).json({ error: 'You do not have permission to perform this action' });
      }
    }

    // Admin-only routes are still enforced after the write gate.
    if (adminRule) {
      if (isAdminRole(req.user)) return next();
      return res.status(403).json({ error: 'You do not have permission to do this' });
    }
    return next();
  });
}

module.exports = rolePolicy;
module.exports.isAdminRole = isAdminRole;
module.exports.canMoveOrderForward = canMoveOrderForward;
module.exports.isViewerRole = isViewerRole;
module.exports.isStaffOrAdminRole = isStaffOrAdminRole;
module.exports.ADMIN_ROLES = ADMIN_ROLES;
