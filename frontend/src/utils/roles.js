// Frontend mirror of the backend role checks (backend/src/middleware/rolePolicy.js).
const ADMIN_ROLES = ['admin', 'administrator', 'manager', 'owner'];

const normalizeRole = (user) => String(user?.role || '').trim().toLowerCase();

export const isAdminRole = (user) => !!user && (
  user.isSuperAdmin || ADMIN_ROLES.includes(normalizeRole(user))
);

export const isViewerRole = (user) => !!user && normalizeRole(user) === 'viewer';
