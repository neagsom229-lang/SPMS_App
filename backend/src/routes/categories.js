// backend/src/routes/categories.js
const express = require('express');
const pool = require('../config/postgres');
const { authenticate, getScope } = require('../middleware/auth');

const router = express.Router();

// ===== GET ALL CATEGORIES =====
router.get('/', authenticate, async (req, res) => {
  const scope = getScope(req, res);
  if (!scope) return;

  try {
    let query = 'SELECT * FROM tbl_categories WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (!scope.isSuperAdmin || scope.tenantId) {
      query += ` AND tenant_id = $${paramIndex}`;
      params.push(scope.tenantId);
      paramIndex++;
    }

    query += ' ORDER BY id DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Categories error:", err.message);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// ===== CREATE CATEGORY =====
router.post('/', authenticate, async (req, res) => {
  const scope = getScope(req, res);
  if (!scope) return;

  const tenantId = scope.tenantId;
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID is required for creation' });
  }

  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  const trimmedName = name.trim();
  if (trimmedName.length > 100) {
    return res.status(400).json({ error: 'Category name cannot exceed 100 characters' });
  }

  try {
    // Check case-insensitive uniqueness per tenant
    const existing = await pool.query(
      `SELECT id FROM tbl_categories WHERE LOWER(name) = LOWER($1) AND tenant_id = $2`,
      [trimmedName, tenantId]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Category with this name already exists' });
    }

    const result = await pool.query(
      `INSERT INTO tbl_categories (name, tenant_id, created_at) VALUES ($1, $2, NOW()) RETURNING *`,
      [trimmedName, tenantId]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ Create category error:', err);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// ===== UPDATE CATEGORY =====
router.put('/:id', authenticate, async (req, res) => {
  const scope = getScope(req, res);
  if (!scope) return;

  const tenantId = scope.tenantId;
  const categoryId = req.params.id;
  const { name } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  const trimmedName = name.trim();
  if (trimmedName.length > 100) {
    return res.status(400).json({ error: 'Category name cannot exceed 100 characters' });
  }

  try {
    // Check if category exists and belongs to tenant
    const catCheck = await pool.query(
      `SELECT id FROM tbl_categories WHERE id = $1 AND tenant_id = $2`,
      [categoryId, tenantId]
    );
    if (catCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Check case-insensitive uniqueness excluding current category
    const existing = await pool.query(
      `SELECT id FROM tbl_categories WHERE LOWER(name) = LOWER($1) AND tenant_id = $2 AND id != $3`,
      [trimmedName, tenantId, categoryId]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Category with this name already exists' });
    }

    const result = await pool.query(
      `UPDATE tbl_categories SET name = $1 WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      [trimmedName, categoryId, tenantId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Update category error:', err);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// ===== DELETE CATEGORY =====
router.delete('/:id', authenticate, async (req, res) => {
  const scope = getScope(req, res);
  if (!scope) return;

  const tenantId = scope.tenantId;
  const categoryId = req.params.id;

  try {
    // Check if category exists and belongs to tenant
    const catCheck = await pool.query(
      `SELECT id FROM tbl_categories WHERE id = $1 AND tenant_id = $2`,
      [categoryId, tenantId]
    );
    if (catCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Check if any products use this category
    const prodCheck = await pool.query(
      `SELECT COUNT(*) as count FROM tbl_products WHERE category_id = $1 AND tenant_id = $2`,
      [categoryId, tenantId]
    );
    const productCount = parseInt(prodCheck.rows[0]?.count || 0, 10);

    if (productCount > 0) {
      return res.status(409).json({
        error: 'Cannot delete category with associated products',
        productCount
      });
    }

    await pool.query(
      `DELETE FROM tbl_categories WHERE id = $1 AND tenant_id = $2`,
      [categoryId, tenantId]
    );

    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    console.error('❌ Delete category error:', err);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

module.exports = router;
