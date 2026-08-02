// backend/src/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../config/database');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// ===== TEST ROUTE =====
router.get('/test', (req, res) => {
  res.json({ message: '✅ Auth route is working' });
});

// ===== LOGIN =====
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  console.log('📤 Login attempt:', { username });

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const result = await pool.query(
      `SELECT u.*, t.id as tenant_id, t.name as tenant_name, t.subdomain
       FROM tbl_users u
       LEFT JOIN tenants t ON u.tenant_id = t.id
       WHERE u.username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      console.log('❌ User not found:', username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    console.log('✅ User found:', { username: user.username, role: user.role });

    // Check if locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remaining = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return res.status(403).json({
        error: `Account locked. Please wait ${remaining} minutes`,
        locked: true,
        remainingMinutes: remaining
      });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    console.log('🔑 Password valid:', isValid);

    if (!isValid) {
      await pool.query(
        `UPDATE tbl_users SET failed_attempts = failed_attempts + 1, last_failed_attempt = NOW()
         WHERE userid = $1`,
        [user.userid]
      );

      const attempts = (user.failed_attempts || 0) + 1;
      if (attempts >= 5) {
        const lockUntil = new Date(Date.now() + 15 * 60000);
        await pool.query(
          `UPDATE tbl_users SET locked_until = $1 WHERE userid = $2`,
          [lockUntil, user.userid]
        );
        return res.status(403).json({
          error: 'Too many failed attempts. Account locked for 15 minutes',
          locked: true,
          remainingMinutes: 15
        });
      }

      return res.status(401).json({
        error: 'Invalid credentials',
        attempts: attempts,
        maxAttempts: 5
      });
    }

    // Reset failed attempts on success
    await pool.query(
      `UPDATE tbl_users SET failed_attempts = 0, locked_until = NULL, last_login = NOW()
       WHERE userid = $1`,
      [user.userid]
    );

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Account is not active' });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user.userid,
        username: user.username,
        role: user.role,
        tenantId: user.is_super_admin ? null : user.tenant_id,
        isSuperAdmin: user.is_super_admin || false
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    console.log('✅ Token generated for:', username);

    // Build user response
    const userResponse = {
      id: user.userid,
      username: user.username,
      fullname: user.fullname,
      email: user.email,
      role: user.role,
      isSuperAdmin: user.is_super_admin || false,
      status: user.status
    };

    if (user.is_super_admin) {
      userResponse.tenant = null;
      userResponse.accessLevel = 'all';
    } else if (user.tenant_id) {
      userResponse.tenant = {
        id: user.tenant_id,
        name: user.tenant_name,
        subdomain: user.subdomain
      };
      userResponse.accessLevel = 'tenant';
    }

    res.json({
      token,
      user: userResponse
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
});

// ===== GET CURRENT USER =====
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = req.user;
    res.json({
      user: {
        id: user.userId,
        username: user.username,
        fullname: user.fullname,
        role: user.role,
        isSuperAdmin: user.isSuperAdmin,
        tenantId: user.tenantId,
        tenantName: user.tenantName
      }
    });
  } catch (error) {
    console.error('❌ Me endpoint error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// ===== LOGOUT =====
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// ===== REGISTER (Super Admin Only) =====
router.post('/register', authenticate, requireSuperAdmin, async (req, res) => {
  const {
    businessName,
    email,
    password,
    phone,
    address,
    subdomain,
    subscriptionPlan = 'free',
    maxUsers = 5,
    maxProducts = 100
  } = req.body;

  if (!businessName || !email || !password || !subdomain) {
    return res.status(400).json({
      error: 'Business name, email, password, and subdomain are required'
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check subdomain
    const existing = await client.query(
      'SELECT id FROM tenants WHERE subdomain = $1',
      [subdomain.toLowerCase()]
    );
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Subdomain already taken' });
    }

    // Check email
    const existingEmail = await client.query(
      'SELECT id FROM tenants WHERE email = $1',
      [email]
    );
    if (existingEmail.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create tenant
    const tenantResult = await client.query(
      `INSERT INTO tenants 
       (name, subdomain, email, phone, address, settings, subscription_plan, max_users, max_products, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING id, name, subdomain`,
      [
        businessName,
        subdomain.toLowerCase(),
        email,
        phone || null,
        address || null,
        '{"theme": "light"}',
        subscriptionPlan,
        maxUsers,
        maxProducts
      ]
    );

    const tenant = tenantResult.rows[0];

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin user
    const userResult = await client.query(
      `INSERT INTO tbl_users 
       (tenant_id, username, password, fullname, email, role, status, createdat)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING userid, username, fullname`,
      [tenant.id, 'admin', hashedPassword, businessName, email, 'Admin', 'ACTIVE']
    );

    // Update tenant owner
    await client.query(
      'UPDATE tenants SET owner_id = $1 WHERE id = $2',
      [userResult.rows[0].userid, tenant.id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Business registered successfully!',
      tenant: {
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  } finally {
    client.release();
  }
});

module.exports = router;