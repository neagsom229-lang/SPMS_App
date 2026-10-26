// backend/src/routes/users.js
const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/postgres');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const getTenantId = (req) => {
  return req.user?.tenantId || req.tenantId || req.headers['x-tenant-id'];
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ===== GET ALL USERS =====
router.get('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;
  const userRole = req.user?.role;

  if (!isSuperAdmin && userRole !== 'Admin' && userRole !== 'Super Admin') {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }

  try {
    let sql = `
      SELECT userid, username, fullname, role, status, created_at, email, is_super_admin, tenant_id
      FROM tbl_users
      WHERE 1=1
    `;
    const params = [];

    if (!isSuperAdmin && tenantId) {
      sql += ` AND tenant_id = $1`;
      params.push(tenantId);
    }

    sql += ` ORDER BY userid`;

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Users error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===== CREATE USER =====
router.post('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;
  const userRole = req.user?.role;

  if (!isSuperAdmin && userRole !== 'Admin' && userRole !== 'Super Admin') {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }

  const { username, password, fullname, email, role, status, tenant_id } = req.body;

  // Validation before touching DB
  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    return res.status(400).json({ error: 'Username is required' });
  }
  if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
    return res.status(400).json({ error: 'Valid email is required' });
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (!role || typeof role !== 'string' || role.trim().length === 0) {
    return res.status(400).json({ error: 'Role is required' });
  }
  if (!fullname || typeof fullname !== 'string' || fullname.trim().length === 0) {
    return res.status(400).json({ error: 'Fullname is required' });
  }

  const targetTenantId = isSuperAdmin ? (tenant_id || tenantId) : tenantId;
    const ROLE_MAP = { admin: 'Admin', manager: 'Manager', cashier: 'Cashier' };
    const roleKey = String(role).trim().toLowerCase();
    const canonicalRole = (isSuperAdmin && roleKey === 'super admin') ? 'Super Admin' : ROLE_MAP[roleKey];
    if (!canonicalRole) {
      return res.status(400).json({ error: 'Role must be Admin, Manager or Cashier' });
    }

  try {
    const existing = await pool.query(
      'SELECT userid FROM tbl_users WHERE (LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2)) AND tenant_id = $3',
      [username.trim(), email.trim(), targetTenantId || null]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Username or email already exists for this tenant' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO tbl_users 
       (tenant_id, username, password, fullname, email, role, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING userid, username, fullname, role, status, email`,
      [
        targetTenantId || null,
        username.trim(),
        hashedPassword,
        fullname.trim(),
        email.trim(),
        canonicalRole,
        status ? status.trim() : 'ACTIVE'
      ]
    );

    res.status(201).json({
      message: 'User created successfully',
      user: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Create user error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===== UPDATE USER =====
router.put('/:id', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;
  const userRole = req.user?.role;

  if (!isSuperAdmin && userRole !== 'Admin' && userRole !== 'Super Admin') {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }

  const { username, fullname, email, role, status, password } = req.body;
  const userId = req.params.id;

  // Validation before touching DB
  if (username !== undefined) {
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      return res.status(400).json({ error: 'Username cannot be empty' });
    }
  }
  if (email !== undefined) {
    if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
  }
  if (password !== undefined && password !== null && password !== '') {
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
  }
  if (role !== undefined) {
    if (!role || typeof role !== 'string' || role.trim().length === 0) {
      return res.status(400).json({ error: 'Role cannot be empty' });
    }
  }

  try {
    let checkQuery = 'SELECT * FROM tbl_users WHERE userid = $1';
    const checkParams = [userId];

    if (!isSuperAdmin && tenantId) {
      checkQuery += ' AND tenant_id = $2';
      checkParams.push(tenantId);
    }

    const existing = await pool.query(checkQuery, checkParams);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (username || email) {
      const dup = await pool.query(
        `SELECT userid FROM tbl_users 
         WHERE (LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2)) 
         AND tenant_id = $3 AND userid != $4`,
        [username || existing.rows[0].username, email || existing.rows[0].email, tenantId || null, userId]
      );
      if (dup.rows.length > 0) {
        return res.status(409).json({ error: 'Username or email already exists for this tenant' });
      }
    }

    let hashedPassword = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const result = await pool.query(
      `UPDATE tbl_users 
       SET username = COALESCE($1, username),
           fullname = COALESCE($2, fullname),
           email = COALESCE($3, email),
           role = COALESCE($4, role),
           status = COALESCE($5, status),
           password = COALESCE($6, password)
       WHERE userid = $7
       RETURNING userid, username, fullname, role, status, email`,
      [username?.trim(), fullname?.trim(), email?.trim(), role?.trim(), status?.trim(), hashedPassword, userId]
    );

    res.json({
      message: 'User updated successfully',
      user: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Update user error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
