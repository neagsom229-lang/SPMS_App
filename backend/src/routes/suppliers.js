// backend/src/routes/suppliers.js
const express = require('express');
const pool = require('../config/postgres');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const getTenantId = (req, res) => {
  if (req.user?.isSuperAdmin) {
    return req.query.tenant_id || req.query.tenantId || req.headers['x-tenant-id'] || null;
  }
  if (!req.user?.tenantId) {
    if (res && !res.headersSent) res.status(403).json({ error: 'Tenant context required' });
    return null;
  }
  return req.user.tenantId;
};

// ===== GET ALL SUPPLIERS =====
router.get('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req, res);
  if (!tenantId && !req.user?.isSuperAdmin) return;
  const isSuperAdmin = req.user?.isSuperAdmin || false;
  const { search } = req.query;

  try {
    let sql = "SELECT * FROM tbl_suppliers WHERE status = 'Active'";
    const params = [];

    if (!isSuperAdmin && tenantId) {
      sql += " AND tenant_id = $1";
      params.push(tenantId);
    }

    if (search) {
      const paramIndex = params.length + 1;
      sql += ` AND (sup_name ILIKE $${paramIndex} OR contact_person ILIKE $${paramIndex} OR phone ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR address ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
    }

    sql += " ORDER BY sup_name";

    const result = await pool.query(sql, params);
    const suppliers = result.rows.map((row) => ({
      SUP_ID: row.id,
      SUP_NAME: row.sup_name,
      CONTACT_PERSON: row.contact_person || '',
      PHONE: row.phone || '',
      EMAIL: row.email || '',
      ADDRESS: row.address || '',
      STATUS: row.status || 'Active',
    }));
    
    res.json(suppliers);
  } catch (err) {
    console.error("❌ Suppliers error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===== CREATE SUPPLIER =====
router.post('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  
  if (!tenantId) {
    return res.status(403).json({ error: 'Tenant context required' });
  }

  const _b = req.body || {}; const _pick = (...k) => { for (const x of k) { if (_b[x] !== undefined) return _b[x]; } return undefined; }; const SUP_NAME = _pick('SUP_NAME', 'sup_name', 'name'); const CONTACT_PERSON = _pick('CONTACT_PERSON', 'contact_person'); const PHONE = _pick('PHONE', 'phone'); const EMAIL = _pick('EMAIL', 'email'); const ADDRESS = _pick('ADDRESS', 'address'); const STATUS = _pick('STATUS', 'status');

  if (!SUP_NAME || SUP_NAME.trim() === '') {
    return res.status(400).json({ error: 'Supplier name is required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO tbl_suppliers 
       (tenant_id, sup_name, contact_person, phone, email, address, status, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) 
       RETURNING id`,
      [
        tenantId,
        SUP_NAME.trim(),
        CONTACT_PERSON || null,
        PHONE || null,
        EMAIL || null,
        ADDRESS || null,
        STATUS || 'Active',
      ]
    );

    res.status(201).json({
      SUP_ID: result.rows[0].id,
      message: 'Supplier created successfully',
    });
  } catch (err) {
    console.error("❌ Create supplier error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===== BULK DELETE =====
router.delete('/bulk', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No supplier IDs provided' });
  }

  try {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const query = `
      DELETE FROM tbl_suppliers 
      WHERE sup_id IN (${placeholders}) AND tenant_id = $${ids.length + 1}
    `;
    const result = await pool.query(query, [...ids, tenantId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Suppliers not found' });
    }

    res.json({
      message: `${result.rowCount} suppliers deleted successfully`,
      deleted: result.rowCount,
    });
  } catch (err) {
    console.error("❌ Bulk delete error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;