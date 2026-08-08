const express = require('express');
const pool = require('../config/postgres');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const getTenantId = (req) => {
  return req.user?.tenantId || req.tenantId || req.headers['x-tenant-id'];
};

// ===== GET SERVICES =====
router.get('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;

  try {
    let query = `
      SELECT s.*, 
             CONCAT(c.first_name, ' ', c.last_name) as customer_name,
             p.name_en as product_name
      FROM tbl_service_requests s
      LEFT JOIN tbl_customers c ON c.id = s.customerid AND c.tenant_id = s.tenant_id
      LEFT JOIN tbl_products p ON p.id = s.productid AND p.tenant_id = s.tenant_id
      WHERE 1=1
    `;
    const params = [];

    if (!isSuperAdmin && tenantId) {
      query += ` AND s.tenant_id = $1`;
      params.push(tenantId);
    }

    query += ` ORDER BY s.serviceid DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Services error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===== CREATE SERVICE =====
router.post('/', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID is required' });
  }

  const {
    CustomerID,
    ProductID,
    SerialNumber,
    IssueDescription,
    ServiceType = 'Repair',
    Status = 'Pending',
    ReceivedDate,
    notes
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO tbl_service_requests 
       (tenant_id, customerid, productid, serialnumber, issuedescription, servicetype, status, receiveddate, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING *`,
      [
        tenantId,
        CustomerID,
        ProductID,
        SerialNumber || `SN-${String(Date.now()).slice(-4)}`,
        IssueDescription || 'Service request',
        ServiceType,
        Status,
        ReceivedDate || new Date().toISOString().split('T')[0],
        notes || ''
      ]
    );

    res.status(201).json({
      message: 'Service created successfully',
      service: result.rows[0]
    });
  } catch (error) {
  console.error('❌ Update service error:', error);
  res.status(500).json({ error: error.message });  // TEMP — revert after debugging
}
});

// ===== UPDATE SERVICE =====
router.put('/:id', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;
  const { id } = req.params;

  const {
    CustomerID,
    ProductID,
    SerialNumber,
    IssueDescription,
    ServiceType,
    Status,
    ReceivedDate,
    notes
  } = req.body;

  try {
    let query = `
      UPDATE tbl_service_requests 
      SET customerid = $1, 
          productid = $2, 
          serialnumber = $3, 
          issuedescription = $4, 
          servicetype = $5, 
          status = $6, 
          receiveddate = $7, 
          notes = $8,
          updated_at = NOW()
      WHERE serviceid = $9
    `;
    const params = [
      CustomerID, ProductID, SerialNumber,
      IssueDescription, ServiceType, Status,
      ReceivedDate, notes, id
    ];

    if (!isSuperAdmin && tenantId) {
      query += ` AND tenant_id = $10`;
      params.push(tenantId);
    }

    const result = await pool.query(query, params);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Service not found or access denied' });
    }

    const updated = await pool.query(
      `SELECT s.*, 
              CONCAT(c.first_name, ' ', c.last_name) as customer_name,
              p.name_en as product_name
       FROM tbl_service_requests s
       LEFT JOIN tbl_customers c ON c.id = s.customerid AND c.tenant_id = s.tenant_id
       LEFT JOIN tbl_products p ON p.id = s.productid AND p.tenant_id = s.tenant_id
       WHERE s.serviceid = $1`,
      [id]
    );

    res.json({
      message: 'Service updated successfully',
      service: updated.rows[0]
    });
  } catch (error) {
    console.error('❌ Update service error:', error);
    res.status(500).json({ error: 'Failed to update service' });
  }
});

// ===== DELETE SERVICE =====
router.delete('/:id', authenticate, async (req, res) => {
  const tenantId = getTenantId(req);
  const isSuperAdmin = req.user?.isSuperAdmin || false;

  try {
    let query = 'DELETE FROM tbl_service_requests WHERE serviceid = $1';
    const params = [req.params.id];

    if (!isSuperAdmin && tenantId) {
      query += ' AND tenant_id = $2';
      params.push(tenantId);
    }

    const result = await pool.query(query, params);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }

    res.status(204).end();
  } catch (error) {
    console.error('❌ Delete service error:', error);
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

module.exports = router;