// backend/src/routes/users.js
const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/postgres');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const getTenantId = (req) => {
  return req.user?.tenantId || req.tenantId || req.headers['x-tenant-id'];
};

// ===== GET ALL USERS =====
router.get('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;
  const userRole = req.user?.role;

  // ✅ Allow Super Admin, Admin, and Super Admin role
  if (!isSuperAdmin && userRole !== 'Admin' && userRole !== 'Super Admin') {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }

  try {
    let sql = `
      SELECT userid, username, fullname, role, status, createdat, email, phone, is_super_admin, tenant_id
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

  const { username, password, fullname, email, phone, role, status, tenant_id } = req.body;

  if (!username || !password || !fullname) {
    return res.status(400).json({ error: 'Username, password, and fullname are required' });
  }

  const targetTenantId = tenant_id || tenantId;

  try {
    const existing = await pool.query(
      'SELECT userid FROM tbl_users WHERE username = $1',
      [username]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO tbl_users 
       (tenant_id, username, password, fullname, email, phone, role, status, createdat)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING userid, username, fullname, role, status`,
      [
        targetTenantId || null,
        username,
        hashedPassword,
        fullname,
        email || null,
        phone || null,
        role || 'Cashier',
        status || 'ACTIVE'
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

  const { username, fullname, email, phone, role, status } = req.body;
  const userId = req.params.id;

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

    if (username) {
      const usernameCheck = await pool.query(
        'SELECT userid FROM tbl_users WHERE username = $1 AND userid != $2',
        [username, userId]
      );
      if (usernameCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Username already exists' });
      }
    }

    const result = await pool.query(
      `UPDATE tbl_users 
       SET username = COALESCE($1, username),
           fullname = COALESCE($2, fullname),
           email = COALESCE($3, email),
           phone = COALESCE($4, phone),
           role = COALESCE($5, role),
           status = COALESCE($6, status)
       WHERE userid = $7
       RETURNING userid, username, fullname, role, status`,
      [username, fullname, email, phone, role, status, userId]
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

// ===== DELETE USER =====
router.delete('/:id', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;
  const userRole = req.user?.role;

  if (!isSuperAdmin && userRole !== 'Admin' && userRole !== 'Super Admin') {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }

  const userId = req.params.id;

  try {
    const userCheck = await pool.query(
      'SELECT is_super_admin FROM tbl_users WHERE userid = $1',
      [userId]
    );
    if (userCheck.rows.length > 0 && userCheck.rows[0].is_super_admin) {
      return res.status(400).json({ error: 'Cannot delete super admin user' });
    }

    let query = 'DELETE FROM tbl_users WHERE userid = $1';
    const params = [userId];

    if (!isSuperAdmin && tenantId) {
      query += ' AND tenant_id = $2';
      params.push(tenantId);
    }

    const result = await pool.query(query, params);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('❌ Delete user error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;