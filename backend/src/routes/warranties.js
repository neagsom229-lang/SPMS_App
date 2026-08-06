const express = require('express');
const pool = require('../config/postgres');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const getTenantId = (req) => {
  return req.user?.tenantId || req.tenantId || req.headers['x-tenant-id'];
};

// ===== GET WARRANTIES =====
router.get('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;

  try {
    let query = `
      SELECT w.*, 
             CONCAT(c.first_name, ' ', c.last_name) as customer_name,
             p.name_en as product_name
      FROM tbl_warranty w
      LEFT JOIN tbl_customers c ON c.id = w.customerid AND c.tenant_id = w.tenant_id
      LEFT JOIN tbl_products p ON p.id = w.productid AND p.tenant_id = w.tenant_id
      WHERE 1=1
    `;
    const params = [];

    if (!isSuperAdmin && tenantId) {
      query += ` AND w.tenant_id = $1`;
      params.push(tenantId);
    }

    query += ` ORDER BY w.warrantyid DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Warranties error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===== CREATE WARRANTY =====
router.post('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID is required' });
  }

  const {
    CustomerID,
    ProductID,
    SerialNumber,
    WarrantyPeriod = 12,
    WarrantyStartDate,
    WarrantyEndDate,
    Status = 'Active',
    notes
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO tbl_warranty 
       (tenant_id, customerid, productid, serialnumber, warrantyperiod, warrantystartdate, warrantyenddate, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        tenantId,
        CustomerID,
        ProductID,
        SerialNumber || `SN-${String(Date.now()).slice(-4)}`,
        WarrantyPeriod,
        WarrantyStartDate || new Date().toISOString().split('T')[0],
        WarrantyEndDate,
        Status,
        notes || ''
      ]
    );

    res.status(201).json({
      message: 'Warranty created successfully',
      warranty: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Create warranty error:', error);
    res.status(500).json({ error: 'Failed to create warranty' });
  }
});

// ===== UPDATE WARRANTY =====
router.put('/:id', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;
  const { id } = req.params;

  const {
    CustomerID,
    ProductID,
    SerialNumber,
    WarrantyPeriod,
    WarrantyStartDate,
    WarrantyEndDate,
    Status,
    notes
  } = req.body;

  try {
    let query = `
      UPDATE tbl_warranty 
      SET customerid = $1, 
          productid = $2, 
          serialnumber = $3, 
          warrantyperiod = $4, 
          warrantystartdate = $5, 
          warrantyenddate = $6, 
          status = $7, 
          notes = $8
      WHERE warrantyid = $9
    `;
    const params = [
      CustomerID, ProductID, SerialNumber,
      WarrantyPeriod, WarrantyStartDate, WarrantyEndDate,
      Status, notes, id
    ];

    if (!isSuperAdmin && tenantId) {
      query += ` AND tenant_id = $10`;
      params.push(tenantId);
    }

    const result = await pool.query(query, params);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Warranty not found or access denied' });
    }

    const updated = await pool.query(
      `SELECT w.*, 
              CONCAT(c.first_name, ' ', c.last_name) as customer_name,
              p.name_en as product_name
       FROM tbl_warranty w
       LEFT JOIN tbl_customers c ON c.id = w.customerid AND c.tenant_id = w.tenant_id
       LEFT JOIN tbl_products p ON p.id = w.productid AND p.tenant_id = w.tenant_id
       WHERE w.warrantyid = $1`,
      [id]
    );

    res.json({
      message: 'Warranty updated successfully',
      warranty: updated.rows[0]
    });
  } catch (error) {
    console.error('❌ Update warranty error:', error);
    res.status(500).json({ error: 'Failed to update warranty' });
  }
});

// ===== DELETE WARRANTY =====
router.delete('/:id', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;

  try {
    let query = 'DELETE FROM tbl_warranty WHERE warrantyid = $1';
    const params = [req.params.id];

    if (!isSuperAdmin && tenantId) {
      query += ' AND tenant_id = $2';
      params.push(tenantId);
    }

    const result = await pool.query(query, params);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Warranty not found' });
    }

    res.status(204).end();
  } catch (error) {
    console.error('❌ Delete warranty error:', error);
    res.status(500).json({ error: 'Failed to delete warranty' });
  }
});

module.exports = router;