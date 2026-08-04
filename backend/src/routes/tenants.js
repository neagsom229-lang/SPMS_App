const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/postgres');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');

const router = express.Router();

// ===== GET ALL TENANTS WITH STATS =====
router.get('/', authenticate, requireSuperAdmin, async (req, res) => {
  const { page = 1, limit = 20, search, status } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let query = `
      SELECT 
        t.*,
        COUNT(DISTINCT u.userid) as user_count,
        COUNT(DISTINCT p.id) as product_count,
        COUNT(DISTINCT o.or_id) as order_count,
        COALESCE(SUM(o.amount_us), 0) as total_revenue,
        MAX(o.order_date) as last_order_date
      FROM tenants t
      LEFT JOIN tbl_users u ON u.tenant_id = t.id
      LEFT JOIN tbl_products p ON p.tenant_id = t.id
      LEFT JOIN tbl_orders o ON o.tenant_id = t.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (t.name ILIKE $${paramIndex} OR t.subdomain ILIKE $${paramIndex} OR t.email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (status) {
      query += ` AND t.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` GROUP BY t.id ORDER BY t.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);

    let countQuery = 'SELECT COUNT(*) as total FROM tenants WHERE 1=1';
    if (search) {
      countQuery += ` AND (name ILIKE '%${search}%' OR subdomain ILIKE '%${search}%' OR email ILIKE '%${search}%')`;
    }
    if (status) {
      countQuery += ` AND status = '${status}'`;
    }

    const countResult = await pool.query(countQuery);

    res.json({
      tenants: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0]?.total || 0),
        totalPages: Math.ceil(parseInt(countResult.rows[0]?.total || 0) / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ Get tenants error:', error);
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

// ===== SYSTEM STATS =====
// THIS IS NOW PLACED ABOVE THE /:id ROUTE TO PREVENT THE "stats" STRING ERROR
router.get('/system/stats', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    // ✅ Simple queries that work
    const tenantsCount = await pool.query('SELECT COUNT(*) as count FROM tenants');
    const usersCount = await pool.query('SELECT COUNT(*) as count FROM tbl_users');
    const productsCount = await pool.query('SELECT COUNT(*) as count FROM tbl_products');
    const ordersCount = await pool.query('SELECT COUNT(*) as count FROM tbl_orders');
    const revenueCount = await pool.query('SELECT COALESCE(SUM(amount_us), 0) as total FROM tbl_orders');
    const customersCount = await pool.query('SELECT COUNT(*) as count FROM tbl_customers');

    res.json({
      totalTenants: parseInt(tenantsCount.rows[0]?.count || 0),
      totalUsers: parseInt(usersCount.rows[0]?.count || 0),
      totalProducts: parseInt(productsCount.rows[0]?.count || 0),
      totalOrders: parseInt(ordersCount.rows[0]?.count || 0),
      totalRevenue: parseFloat(revenueCount.rows[0]?.total || 0),
      totalCustomers: parseInt(customersCount.rows[0]?.count || 0),
    });
  } catch (error) {
    console.error('❌ System stats error:', error);
    res.status(500).json({ error: 'Failed to fetch system stats' });
  }
});

// ===== GET SINGLE TENANT DETAILS =====
router.get('/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        t.*,
        COUNT(DISTINCT u.userid) as user_count,
        COUNT(DISTINCT p.id) as product_count,
        COUNT(DISTINCT o.or_id) as order_count,
        COALESCE(SUM(o.amount_us), 0) as total_revenue,
        MAX(o.order_date) as last_order_date
       FROM tenants t
       LEFT JOIN tbl_users u ON u.tenant_id = t.id
       LEFT JOIN tbl_products p ON p.tenant_id = t.id
       LEFT JOIN tbl_orders o ON o.tenant_id = t.id
       WHERE t.id = $1
       GROUP BY t.id`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Get tenant error:', error);
    res.status(500).json({ error: 'Failed to fetch tenant' });
  }
});

// ===== CREATE TENANT =====
router.post('/', authenticate, requireSuperAdmin, async (req, res) => {
  const {
    name, subdomain, email, phone, address, status,
    subscription_plan = 'free', max_users = 5, max_products = 100,
    settings
  } = req.body;

  if (!name || !subdomain || !email) {
    return res.status(400).json({ error: 'Name, subdomain, and email are required' });
  }

  try {
    const existing = await pool.query(
      'SELECT id FROM tenants WHERE subdomain = $1',
      [subdomain.toLowerCase()]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Subdomain already taken' });
    }

    const existingEmail = await pool.query(
      'SELECT id FROM tenants WHERE email = $1',
      [email]
    );
    if (existingEmail.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const result = await pool.query(
      `INSERT INTO tenants 
       (name, subdomain, email, phone, address, status, subscription_plan, max_users, max_products, settings, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       RETURNING *`,
      [
        name,
        subdomain.toLowerCase(),
        email,
        phone || null,
        address || null,
        status || 'ACTIVE',
        subscription_plan,
        max_users,
        max_products,
        settings || '{"theme": "light"}'
      ]
    );

    const defaultPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    
    await pool.query(
      `INSERT INTO tbl_users 
       (tenant_id, username, password, fullname, email, role, status, createdat)
       VALUES ($1, $2, $3, $4, $5, 'Admin', 'ACTIVE', NOW())`,
      [result.rows[0].id, 'admin', hashedPassword, name, email]
    );

    res.status(201).json({
      message: 'Tenant created successfully',
      tenant: result.rows[0],
      defaultCredentials: {
        username: 'admin',
        password: 'admin123'
      }
    });
  } catch (error) {
    console.error('❌ Create tenant error:', error);
    res.status(500).json({ error: 'Failed to create tenant' });
  }
});

// ===== UPDATE TENANT =====
router.put('/:id', authenticate, requireSuperAdmin, async (req, res) => {
  const {
    name, email, phone, address, status,
    subscription_plan, max_users, max_products,
    settings
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE tenants 
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           phone = COALESCE($3, phone),
           address = COALESCE($4, address),
           status = COALESCE($5, status),
           subscription_plan = COALESCE($6, subscription_plan),
           max_users = COALESCE($7, max_users),
           max_products = COALESCE($8, max_products),
           settings = COALESCE($9, settings),
           updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [
        name, email, phone, address, status,
        subscription_plan, max_users, max_products,
        settings, req.params.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json({
      message: 'Tenant updated successfully',
      tenant: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Update tenant error:', error);
    res.status(500).json({ error: 'Failed to update tenant' });
  }
});

// ===== DELETE TENANT =====
router.delete('/:id', authenticate, requireSuperAdmin, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query('DELETE FROM order_items WHERE tenant_id = $1', [req.params.id]);
    await client.query('DELETE FROM tbl_orders WHERE tenant_id = $1', [req.params.id]);
    await client.query('DELETE FROM tbl_products WHERE tenant_id = $1', [req.params.id]);
    await client.query('DELETE FROM tbl_customers WHERE tenant_id = $1', [req.params.id]);
    await client.query('DELETE FROM tbl_suppliers WHERE tenant_id = $1', [req.params.id]);
    await client.query('DELETE FROM tbl_categories WHERE tenant_id = $1', [req.params.id]);
    await client.query('DELETE FROM tbl_stock WHERE tenant_id = $1', [req.params.id]);
    await client.query('DELETE FROM tbl_warranty WHERE tenant_id = $1', [req.params.id]);
    await client.query('DELETE FROM tbl_service_requests WHERE tenant_id = $1', [req.params.id]);
    await client.query('DELETE FROM tbl_activity_logs WHERE tenant_id = $1', [req.params.id]);
    await client.query('DELETE FROM tbl_users WHERE tenant_id = $1', [req.params.id]);
    await client.query('DELETE FROM tenants WHERE id = $1', [req.params.id]);

    await client.query('COMMIT');

    res.json({ message: 'Tenant deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Delete tenant error:', error);
    res.status(500).json({ error: 'Failed to delete tenant' });
  } finally {
    client.release();
  }
});

module.exports = router;