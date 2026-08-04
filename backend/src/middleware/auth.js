  // backend/src/middleware/auth.js
  const jwt = require('jsonwebtoken');
  const pool = require('../config/postgres');
  require('dotenv').config();

  const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

  // ===== AUTHENTICATE MIDDLEWARE =====
  const authenticate = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Get user from database
      const result = await pool.query(
        `SELECT u.userid, u.username, u.fullname, u.role, u.status, 
                u.is_super_admin, u.tenant_id,
                t.id as tenant_id, t.name as tenant_name, t.subdomain
        FROM tbl_users u
        LEFT JOIN tenants t ON u.tenant_id = t.id
        WHERE u.userid = $1`,
        [decoded.userId]
      );
      
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'User not found' });
      }
      
      const user = result.rows[0];
      
      // Check if user is active
      if (user.status !== 'ACTIVE') {
        return res.status(403).json({ error: 'Account is not active' });
      }
      
      req.user = {
        userId: user.userid,
        username: user.username,
        fullname: user.fullname,
        role: user.role,
        tenantId: user.is_super_admin ? null : user.tenant_id,
        tenantName: user.tenant_name,
        subdomain: user.subdomain,
        isSuperAdmin: user.is_super_admin || false,
        status: user.status
      };
      
      next();
    } catch (error) {
      console.error('❌ Auth error:', error.message);
      return res.status(401).json({ error: 'Invalid token' });
    }
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
    requireSuperAdmin,
    authorize,
    JWT_SECRET 
  };