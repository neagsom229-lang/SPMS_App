// backend/src/routes/suppliers.js
const express = require('express');
const pool = require('../config/postgres');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const getTenantId = (req) => {
  return req.user?.tenantId || req.tenantId || req.headers['x-tenant-id'];
};

// ===== GET ALL SUPPLIERS =====
router.get('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
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
      sql += ` AND (company ILIKE $${paramIndex} OR first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex} OR phone ILIKE $${paramIndex} OR e_mail ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
    }

    sql += " ORDER BY company";

    const result = await pool.query(sql, params);
    const suppliers = result.rows.map((row) => ({
      SUP_ID: row.sup_id,
      SUP_NAME: row.company,
      CONTACT_PERSON: [row.first_name, row.last_name].filter(Boolean).join(' '),
      PHONE: row.phone,
      EMAIL: row.e_mail,
      ADDRESS: row.address,
      STATUS: row.status,
      WEBSITE: row.website,
      TAX_ID: row.tax_id,
      NOTES: row.notes,
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

  const { SUP_NAME, CONTACT_PERSON, PHONE, EMAIL, ADDRESS, WEBSITE, STATUS, TAX_ID, NOTES } = req.body;

  if (!SUP_NAME || SUP_NAME.trim() === '') {
    return res.status(400).json({ error: 'Supplier name is required' });
  }

  let firstName = '', lastName = '';
  if (CONTACT_PERSON) {
    const parts = CONTACT_PERSON.trim().split(' ');
    if (parts.length > 1) {
      firstName = parts[0];
      lastName = parts.slice(1).join(' ');
    } else {
      firstName = parts[0];
    }
  }

  try {
    const result = await pool.query(
      `INSERT INTO tbl_suppliers 
       (tenant_id, sup_id, company, first_name, last_name, phone, e_mail, address, status, website, tax_id, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
       RETURNING sup_id`,
      [
        tenantId,
        `SUP${String(Date.now()).slice(-6)}`,
        SUP_NAME.trim(),
        firstName || null,
        lastName || null,
        PHONE || null,
        EMAIL || null,
        ADDRESS || null,
        STATUS || 'Active',
        WEBSITE || null,
        TAX_ID || null,
        NOTES || null,
      ]
    );

    res.status(201).json({
      SUP_ID: result.rows[0].sup_id,
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