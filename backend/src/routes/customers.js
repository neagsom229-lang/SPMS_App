// backend/src/routes/customers.js
const express = require('express');
const pool = require('../config/postgres');
const { authenticate, getScope } = require('../middleware/auth');

const router = express.Router();

const getTenantId = (req, res) => {
  const scope = getScope(req, res);
  return scope ? scope.tenantId : null;
};

// ===== GET ALL CUSTOMERS =====
router.get('/', authenticate, async (req, res) => {
  const scope = getScope(req, res);
  if (!scope) return;
  const tenantId = scope.tenantId;
  const isSuperAdmin = scope.isSuperAdmin;
  const { search } = req.query;

  try {
    let sql = "SELECT * FROM tbl_customers WHERE LOWER(status) = 'active'";
    const params = [];

    if (!isSuperAdmin && tenantId) {
      sql += " AND tenant_id = $1";
      params.push(tenantId);
    }

    if (search) {
      const paramIndex = params.length + 1;
      sql += ` AND (name ILIKE $${paramIndex} OR phone ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
    }

    sql += " ORDER BY name ASC";

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Customers error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===== CREATE CUSTOMER =====
router.post('/', authenticate, async (req, res) => {
  const scope = getScope(req, res);
  if (!scope) return;
  const tenantId = scope.tenantId;
  
  if (!tenantId) {
    return res.status(403).json({ error: 'Tenant context required' });
  }

  const { name, FIRST_NAME, LAST_NAME, phone, PHONE, email, E_MAIL, address, ADDRESS, status } = req.body;
  const customerName = name || `${FIRST_NAME || ''} ${LAST_NAME || ''}`.trim() || 'Customer';
  const customerPhone = phone || PHONE || null;
  const customerEmail = email || E_MAIL || null;
  const customerAddress = address || ADDRESS || null;

  try {
    if (customerPhone) {
      const phoneCheck = await pool.query(
        'SELECT id FROM tbl_customers WHERE phone = $1 AND tenant_id = $2',
        [customerPhone.trim(), tenantId]
      );
      if (phoneCheck.rows.length > 0) {
        return res.status(409).json({ error: 'Customer with this phone number already exists' });
      }
    }

    const result = await pool.query(
      `INSERT INTO tbl_customers 
       (tenant_id, cus_id, name, email, phone, address, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [
        tenantId,
        `CUS${String(Date.now()).slice(-6)}`,
        customerName.trim(),
        customerEmail ? customerEmail.trim() : null,
        customerPhone ? customerPhone.trim() : null,
        customerAddress ? customerAddress.trim() : null,
        status ? status.trim() : 'Active'
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Create customer error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===== UPDATE CUSTOMER =====
router.put('/:id', authenticate, async (req, res) => {
  const scope = getScope(req, res);
  if (!scope) return;
  const tenantId = scope.tenantId;
  if (!tenantId) {
    return res.status(403).json({ error: 'Tenant context required' });
  }

  const customerId = req.params.id;
  const { name, phone, email, address, status } = req.body;

  try {
    const existing = await pool.query(
      'SELECT id FROM tbl_customers WHERE id = $1 AND tenant_id = $2',
      [customerId, tenantId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    if (phone !== undefined && phone !== null && phone.trim() !== '') {
      const phoneCheck = await pool.query(
        'SELECT id FROM tbl_customers WHERE phone = $1 AND tenant_id = $2 AND id != $3',
        [phone.trim(), tenantId, customerId]
      );
      if (phoneCheck.rows.length > 0) {
        return res.status(409).json({ error: 'Customer with this phone number already exists' });
      }
    }

    const updateFields = [];
    const params = [];
    let idx = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${idx++}`);
      params.push(name.trim());
    }
    if (phone !== undefined) {
      updateFields.push(`phone = $${idx++}`);
      params.push(phone ? phone.trim() : null);
    }
    if (email !== undefined) {
      updateFields.push(`email = $${idx++}`);
      params.push(email ? email.trim() : null);
    }
    if (address !== undefined) {
      updateFields.push(`address = $${idx++}`);
      params.push(address ? address.trim() : null);
    }
    if (status !== undefined) {
      updateFields.push(`status = $${idx++}`);
      params.push(status.trim());
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(customerId, tenantId);
    const sql = `UPDATE tbl_customers SET ${updateFields.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`;

    const result = await pool.query(sql, params);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Update customer error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===== DELETE CUSTOMER (SOFT DELETE) =====
router.delete('/:id', authenticate, async (req, res) => {
  const scope = getScope(req, res);
  if (!scope) return;
  const tenantId = scope.tenantId;
  if (!tenantId) {
    return res.status(403).json({ error: 'Tenant context required' });
  }

  const customerId = req.params.id;

  try {
    const existing = await pool.query(
      'SELECT id FROM tbl_customers WHERE id = $1 AND tenant_id = $2',
      [customerId, tenantId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const result = await pool.query(
      `UPDATE tbl_customers SET status = 'Inactive' WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [customerId, tenantId]
    );

    res.json({ message: 'Customer deactivated successfully', customer: result.rows[0] });
  } catch (err) {
    console.error("❌ Delete customer error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
