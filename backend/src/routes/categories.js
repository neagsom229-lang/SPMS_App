const express = require('express');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ===== GET ALL CATEGORIES =====
router.get('/', authenticate, async (req, res) => {
  const tenantId = req.tenantId || req.user?.tenantId;

  try {
    const result = await pool.query(
      'SELECT * FROM tbl_categories WHERE tenant_id = $1 ORDER BY id',
      [tenantId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// ===== CREATE CATEGORY =====
router.post('/', authenticate, async (req, res) => {
  const tenantId = req.tenantId || req.user?.tenantId;
  const { category_en, category_kh, description } = req.body;

  if (!category_en) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO tbl_categories (tenant_id, category_en, category_kh, description, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [tenantId, category_en, category_kh || null, description || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// ===== UPDATE CATEGORY =====
router.put('/:id', authenticate, async (req, res) => {
  const tenantId = req.tenantId || req.user?.tenantId;
  const { category_en, category_kh, description } = req.body;

  try {
    const result = await pool.query(
      `UPDATE tbl_categories 
       SET category_en = $1, category_kh = $2, description = $3, updated_at = NOW()
       WHERE id = $4 AND tenant_id = $5
       RETURNING *`,
      [category_en, category_kh, description, req.params.id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// ===== DELETE CATEGORY =====
router.delete('/:id', authenticate, async (req, res) => {
  const tenantId = req.tenantId || req.user?.tenantId;

  try {
    const result = await pool.query(
      'DELETE FROM tbl_categories WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [req.params.id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.status(204).end();
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

module.exports = router;