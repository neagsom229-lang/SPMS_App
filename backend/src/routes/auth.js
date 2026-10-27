// backend/src/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/postgres');
const { authenticate, requireSuperAdmin, isActiveStatus, isTenantStatusValid } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

// ============================================
// TEST ROUTE
// ============================================
router.get('/test', (req, res) => {
  res.json({
    message: '✅ Auth route is working!',
    timestamp: new Date().toISOString(),
    status: 'ok'
  });
});

// ============================================
// LOGIN
// ============================================
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const result = await db.query(
  `SELECT u.userid, u.username, u.password, u.fullname, u.role, u.status, u.email,
          u.is_super_admin, u.tenant_id as user_tenant_id, u.must_change_password,
          t.id as tenant_row_id, t.name as tenant_name, t.subdomain, t.status as tenant_status
   FROM tbl_users u
   LEFT JOIN tenants t ON u.tenant_id = t.id
   WHERE LOWER(u.username) = LOWER($1) OR LOWER(u.email) = LOWER($1)`,
  [username]
);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    if (!isActiveStatus(user.status)) {
      return res.status(403).json({ error: 'Account is not active' });
    }

    if (user.user_tenant_id && !user.tenant_row_id) {
      return res.status(403).json({ error: 'Tenant account not found (orphaned user)' });
    }

    if (!isTenantStatusValid(user)) {
      return res.status(403).json({ error: 'Tenant account is not active' });
    }

    const isValidPassword = user.password && user.password.startsWith('$2') && await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      {
        userId: user.userid,
        username: user.username,
        role: user.role || 'Admin',
        tenantId: user.is_super_admin ? null : user.user_tenant_id,
        isSuperAdmin: user.is_super_admin || false,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const userResponse = {
      user_id: user.userid,
      username: user.username,
      email: user.email || `${username}@example.com`,
      role: user.role || 'Admin',
      role_name: user.role || 'Admin',
      status: user.status,
      fullname: user.fullname || user.username,
      isSuperAdmin: user.is_super_admin || false,
      mustChangePassword: user.must_change_password || false,
    };

    if (user.is_super_admin) {
      userResponse.tenant = null;
      userResponse.accessLevel = 'all';
    } else if (user.user_tenant_id) {
      userResponse.tenant = {
        id: user.user_tenant_id,
        name: user.tenant_name,
        subdomain: user.subdomain,
      };
      userResponse.accessLevel = 'tenant';
    }

    res.json({
      token,
      user: userResponse,
    });
  } catch (err) {
    console.error('❌ Login error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// ============================================
// GET CURRENT USER
// ============================================
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
  } catch (err) {
    console.error('❌ Me endpoint error:', err.message);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// ============================================
// LOGOUT
// ============================================
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// ============================================
// CLIENT SELF-REGISTRATION
// ============================================
router.post('/register-client', async (req, res) => {
  const {
    businessName,
    email,
    password,
    phone,
    address,
    subdomain
  } = req.body;

  if (!businessName || !email || !password || !subdomain) {
    return res.status(400).json({
      error: 'Business name, email, password, and subdomain are required'
    });
  }

  const subdomainRegex = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;
  const reservedSubdomains = ['admin', 'api', 'www', 'app', 'auth', 'dashboard', 'login', 'register', 'status', 'health', 'test', 'public', 'system'];
  if (!subdomainRegex.test(subdomain.toLowerCase()) || reservedSubdomains.includes(subdomain.toLowerCase())) {
    return res.status(400).json({ error: 'Invalid or reserved subdomain format' });
  }

  if (password.length < 8) {
    return res.status(400).json({
      error: 'Password must be at least 8 characters'
    });
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // 1. Check subdomain
    const existingSubdomain = await client.query(
      'SELECT id FROM tenants WHERE subdomain = $1',
      [subdomain.toLowerCase()]
    );
    if (existingSubdomain.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Subdomain already taken. Please choose another.' });
    }

    // 2. Check email in tbl_users
    const existingEmail = await client.query(
      'SELECT userid FROM tbl_users WHERE email = $1',
      [email]
    );
    if (existingEmail.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Email already registered. Please use another email.' });
    }

    // 3. Create tenant
    const tenantResult = await client.query(
      `INSERT INTO tenants 
       (name, subdomain, status, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, name, subdomain`,
      [
        businessName,
        subdomain.toLowerCase(),
        'ACTIVE'
      ]
    );

    const tenant = tenantResult.rows[0];

    // 4. Create unique username
    let uniqueUsername = `${subdomain.toLowerCase()}_admin`;
    const userExist = await client.query('SELECT userid FROM tbl_users WHERE username = $1', [uniqueUsername]);
    if (userExist.rows.length > 0) {
      uniqueUsername = `${subdomain.toLowerCase()}_admin_${crypto.randomBytes(2).toString('hex')}`;
    }

    // 5. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 6. Create admin user with tenant_id
    const userResult = await client.query(
      `INSERT INTO tbl_users 
       (tenant_id, username, password, fullname, email, role, status, must_change_password, created_at)
       VALUES ($1, $2, $3, $4, $5, 'Admin', 'ACTIVE', FALSE, NOW())
       RETURNING userid, username, fullname, role`,
      [tenant.id, uniqueUsername, hashedPassword, businessName, email]
    );

    const user = userResult.rows[0];

    // 6.5 Insert store_settings
    await client.query(
      `INSERT INTO store_settings 
       (tenant_id, slug, store_name, phone, address, currency, exchange_rate, is_open, accepts_online_orders, delivery_enabled, pickup_enabled, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'USD', 4000, true, true, false, true, NOW(), NOW())
       ON CONFLICT (slug) DO NOTHING`,
      [tenant.id, subdomain.toLowerCase(), businessName, phone || null, address || null]
    );

    // 6.6 Insert default category "General"
    await client.query(
      `INSERT INTO tbl_categories (name, tenant_id, created_at) VALUES ('General', $1, NOW())`,
      [tenant.id]
    );

    await client.query('COMMIT');

    // 7. Generate JWT
    const token = jwt.sign(
      {
        userId: user.userid,
        username: user.username,
        role: user.role,
        tenantId: tenant.id,
        tenantName: tenant.name,
        isSuperAdmin: false
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain
      },
      user: {
        id: user.userid,
        username: user.username,
        fullname: user.fullname,
        role: user.role
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Registration error:', error.message);
    res.status(500).json({
      error: 'Registration failed'
    });
  } finally {
    client.release();
  }
});

// ============================================
// REGISTER (Super Admin Only)
// ============================================
router.post('/register', authenticate, requireSuperAdmin, async (req, res) => {
  const { username, email, password, firstName, lastName, companyName } = req.body;

  if (!username || !email || !password || !firstName || !lastName || !companyName) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const existingUser = await db.query(
      `SELECT userid FROM tbl_users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2)`,
      [username, email]
    );
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const fullName = `${firstName} ${lastName}`;

    const result = await db.query(
      `INSERT INTO tbl_users (username, password, fullname, role, status, email) 
       VALUES ($1, $2, $3, 'Admin', 'ACTIVE', $4) 
       RETURNING userid, username, role`,
      [username, hashedPassword, fullName, email]
    );

    const user = result.rows[0];

    res.status(201).json({
      message: 'Account created successfully',
      user: {
        user_id: user.userid,
        username: user.username,
        role: user.role,
        fullname: fullName,
        email: email,
      },
    });
  } catch (err) {
    console.error('❌ Registration error:', err.message);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

module.exports = router;