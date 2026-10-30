// backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const pool = require('../config/postgres');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const isActiveStatus = (status) => {
  if (!status) return false;
  return String(status).trim().toUpperCase() === 'ACTIVE';
};

const isTenantStatusValid = (user) => {
  if (user.is_super_admin) return true;
  if (!user.user_tenant_id) return true;
  if (!user.tenant_row_id) return false; // Orphaned user
  const tStatus = user.tenant_status;
  if (!tStatus) return true;
  const normalized = String(tStatus).trim().toLowerCase();
  return !['suspended', 'inactive', 'cancelled', 'deleted'].includes(normalized);
};

// ===== AUTHENTICATE MIDDLEWARE =====
const authenticate = async (req, res, next) => {
  if (req._authenticated) return next();

  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    
    // Get user from database
    const result = await pool.query(
      `SELECT u.userid, u.username, u.fullname, u.role, u.status, 
              u.is_super_admin, u.tenant_id as user_tenant_id, u.must_change_password, u.token_version,
              t.id as tenant_row_id, t.name as tenant_name, t.subdomain, t.status as tenant_status
      FROM tbl_users u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      WHERE u.userid = $1`,
      [decoded.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];

    const tokenVersion = decoded.tokenVersion || decoded.token_version || 1;
    const dbTokenVersion = user.token_version || 1;
    if (Number(tokenVersion) !== Number(dbTokenVersion)) {
      return res.status(401).json({ error: 'Token has been revoked or invalidated' });
    }

    if (user.must_change_password) {
      const path = req.path || req.url || '';
      if (!path.includes('change-password') && !path.includes('update-password') && !path.includes('auth/logout') && !path.includes('auth/me')) {
        return res.status(403).json({ error: 'PASSWORD_CHANGE_REQUIRED', message: 'Password change required' });
      }
    }
    
    if (!isActiveStatus(user.status)) {
      return res.status(403).json({ error: 'Account is not active' });
    }

    if (user.user_tenant_id && !user.tenant_row_id) {
      return res.status(403).json({ error: 'Tenant account not found (orphaned user)' });
    }

    if (!isTenantStatusValid(user)) {
      return res.status(403).json({ error: 'Tenant account is not active' });
    }
    
    req.user = {
      userId: user.userid,
      username: user.username,
      fullname: user.fullname,
      role: user.role,
      tenantId: user.is_super_admin ? null : user.user_tenant_id,
      tenantName: user.tenant_name,
      subdomain: user.subdomain,
      isSuperAdmin: user.is_super_admin || false,
      status: user.status,
      tokenVersion: dbTokenVersion
    };
    
    req._authenticated = true;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError' || error.name === 'NotBeforeError' || error.message.includes('jwt')) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    console.error('❌ DB/Auth error during authenticate:', error.message);
    return res.status(503).json({ error: 'Database service unavailable' });
  }
};

// ===== GET SCOPE HELPER & REQUIRE TENANT MIDDLEWARE =====
const requireTenant = (req, res, next) => {
  if (!req.user) {
    if (res && !res.headersSent) res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  let tenantId = null;
  if (req.user.isSuperAdmin) {
    const tenantIdParam = req.query.tenant_id || req.headers['x-tenant-id'];
    if (tenantIdParam !== undefined && tenantIdParam !== null && tenantIdParam !== '') {
      if (Array.isArray(tenantIdParam) || !/^[1-9]\d{0,9}$/.test(String(tenantIdParam))) {
        if (res && !res.headersSent) res.status(400).json({ error: 'Invalid tenant_id format' });
        return null;
      }
      tenantId = parseInt(tenantIdParam, 10);
    } else {
      const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
      if (isWrite && !req.path.includes('/tenants')) {
        if (res && !res.headersSent) res.status(403).json({ error: 'Super Admin write operations require an explicit valid tenant_id' });
        return null;
      }
      tenantId = null;
    }
  } else {
    if (!req.user.tenantId) {
      if (res && !res.headersSent) res.status(403).json({ error: 'Tenant context required' });
      return null;
    }
    tenantId = req.user.tenantId;
  }

  req.tenantId = tenantId;
  req.scope = { isSuperAdmin: req.user.isSuperAdmin, tenantId };

  if (typeof next === 'function') {
    return next();
  }
  return req.scope;
};

const getScope = (req, res) => {
  return requireTenant(req, res, null);
};

// ===== SUPER ADMIN MIDDLEWARE =====
const requireSuperAdmin = async (req, res, next) => {
  if (!req.user || !req.user.isSuperAdmin) {
    return res.status(403).json({ 
      error: 'Access denied. Super Admin privileges required.' 
    });
  }
  next();
};

// ===== AUTHORIZE BY ROLE =====
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
};

module.exports = { 
  authenticate, 
  getScope,
  requireTenant,
  requireSuperAdmin,
  authorize,
  isActiveStatus,
  isTenantStatusValid,
  JWT_SECRET 
};
