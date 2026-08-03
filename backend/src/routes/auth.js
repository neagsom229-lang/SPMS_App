// backend/src/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/postgres');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// ===== TEST ROUTE =====
router.get('/test', (req, res) => {
  res.json({ 
    message: '✅ Auth route is working!',
    timestamp: new Date().toISOString(),
    status: 'ok'
  });
});

// ===== LOGIN =====
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  console.log('🔑 Login attempt:', username);

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const result = await db.query(
      `SELECT u.userid, u.username, u.password, u.fullname, u.role, u.status, u.email,
              u.is_super_admin, u.tenant_id,
              t.id as tenant_id, t.name as tenant_name, t.subdomain
       FROM tbl_users u
       LEFT JOIN tenants t ON u.tenant_id = t.id
       WHERE LOWER(u.username) = LOWER($1)`,
      [username]
    );

    const user = result.rows[0];

    if (!user) {
      console.log('❌ User not found:', username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.status !== 'ACTIVE') {
      console.log('❌ User not active:', username);
      return res.status(403).json({ error: 'Account is not active' });
    }

    // ✅ Use bcrypt to compare password
    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log('🔑 Password valid:', isValidPassword);

    if (!isValidPassword) {
      console.log('❌ Password incorrect for:', username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('✅ Login successful:', username);

    const token = jwt.sign(
      {
        userId: user.userid,
        username: user.username,
        role: user.role || 'Admin',
        tenantId: user.is_super_admin ? null : user.tenant_id,
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
    };

    if (user.is_super_admin) {
      userResponse.tenant = null;
      userResponse.accessLevel = 'all';
    } else if (user.tenant_id) {
      userResponse.tenant = {
        id: user.tenant_id,
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
  } catch (err) {
    console.error('❌ Me endpoint error:', err.message);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// ===== LOGOUT =====
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// ===== ✅ CLIENT SELF-REGISTRATION =====
router.post('/register-client', async (req, res) => {
  const { 
    businessName, 
    email, 
    password, 
    phone, 
    address,
    subdomain 
  } = req.body;

  console.log('📤 Registering client:', { businessName, email, subdomain });

  // Validate required fields
  if (!businessName || !email || !password || !subdomain) {
    return res.status(400).json({ 
      error: 'Business name, email, password, and subdomain are required' 
    });
  }

  if (password.length < 8) {
    return res.status(400).json({ 
      error: 'Password must be at least 8 characters' 
    });
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // Check if subdomain exists
    const existingSubdomain = await client.query(
      'SELECT id FROM tenants WHERE subdomain = $1',
      [subdomain.toLowerCase()]
    );
    if (existingSubdomain.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Subdomain already taken. Please choose another.' });
    }

    // Check if email exists
    const existingEmail = await client.query(
      'SELECT id FROM tenants WHERE email = $1',
      [email]
    );
    if (existingEmail.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Email already registered. Please use another email.' });
    }

    // Create tenant
    const tenantResult = await client.query(
      `INSERT INTO tenants 
       (name, subdomain, email, phone, address, settings, subscription_plan, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', NOW())
       RETURNING id, name, subdomain`,
      [
        businessName,
        subdomain.toLowerCase(),
        email,
        phone || null,
        address || null,
        '{"theme": "light"}',
        'free'
      ]
    );

    const tenant = tenantResult.rows[0];

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin user for the tenant
    const userResult = await client.query(
      `INSERT INTO tbl_users 
       (tenant_id, username, password, fullname, email, role, status, createdat)
       VALUES ($1, $2, $3, $4, $5, 'Admin', 'ACTIVE', NOW())
       RETURNING userid, username, fullname, role`,
      [tenant.id, 'admin', hashedPassword, businessName, email]
    );

    const user = userResult.rows[0];

    // Create default categories for the tenant
    const categories = [
      ['Electronics', 'Electronic products and gadgets'],
      ['Furniture', 'Furniture and home items'],
      ['Clothing', 'Clothing and apparel'],
      ['Food', 'Food and beverages'],
      ['Office Supplies', 'Office and stationery items']
    ];

    for (const [name, desc] of categories) {
      await client.query(
        `INSERT INTO tbl_categories (tenant_id, category_en, category_kh, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [tenant.id, name, desc]
      );
    }

    await client.query('COMMIT');

    // Generate JWT
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
      message: 'Business registered successfully!',
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
    console.error('❌ Registration error:', error);
    res.status(500).json({ 
      error: 'Registration failed. Please try again later.' 
    });
  } finally {
    client.release();
  }
});

// ===== REGISTER (Super Admin Only) =====
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