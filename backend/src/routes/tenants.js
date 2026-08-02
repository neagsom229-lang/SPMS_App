// backend/routes/tenants.js
const express = require('express');
const pool = require('../config/database');
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
        COUNT(DISTINCT o.id) as order_count,
        COALESCE(SUM(o.total_amount), 0) as total_revenue,
        MAX(o.created_at) as last_order_date
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

    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM tenants WHERE 1=1' + 
      (search ? ` AND (name ILIKE '%${search}%' OR subdomain ILIKE '%${search}%' OR email ILIKE '%${search}%')` : '') +
      (status ? ` AND status = '${status}'` : '')
    );

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
    console.error('Get tenants error:', error);
    res.status(500).json({ error: 'Failed to fetch tenants' });
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
        COUNT(DISTINCT o.id) as order_count,
        COALESCE(SUM(o.total_amount), 0) as total_revenue,
        MAX(o.created_at) as last_order_date
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
    console.error('Get tenant error:', error);
    res.status(500).json({ error: 'Failed to fetch tenant' });
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

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update tenant error:', error);
    res.status(500).json({ error: 'Failed to update tenant' });
  }
});

// ===== DELETE TENANT =====
router.delete('/:id', authenticate, requireSuperAdmin, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Delete all data for this tenant
    await client.query('DELETE FROM order_items WHERE tenant_id = $1', [req.params.id]);
    await client.query('DELETE FROM tbl_orders WHERE tenant_id = $1', [req.params.id]);
    await client.query('DELETE FROM tbl_products WHERE tenant_id = $1', [req.params.id]);
    await client.query('DELETE FROM tbl_customers WHERE tenant_id = $1', [req.params.id]);
    await client.query('DELETE FROM tbl_suppliers WHERE tenant_id = $1', [req.params.id]);
    await client.query('DELETE FROM tbl_categories WHERE tenant_id = $1', [req.params.id]);
    await client.query('DELETE FROM tbl_stock WHERE tenant_id = $1', [req.params.id]);
    await client.query('DELETE FROM tbl_users WHERE tenant_id = $1', [req.params.id]);
    await client.query('DELETE FROM tenants WHERE id = $1', [req.params.id]);

    await client.query('COMMIT');

    res.json({ message: 'Tenant deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete tenant error:', error);
    res.status(500).json({ error: 'Failed to delete tenant' });
  } finally {
    client.release();
  }
});

module.exports = router;