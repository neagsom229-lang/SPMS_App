// backend/src/routes/reports.js
const express = require('express');
const ExcelJS = require('exceljs');
const pool = require('../config/postgres');
const { authenticate, getScope } = require('../middleware/auth');
const { REVENUE_STATUSES, EXCLUDED_STATUSES } = require('../constants/sales');

const router = express.Router();

// Each report: SQL (tenant-filtered) + column definitions
const REPORTS = {
  products: {
    sql: `SELECT p.id, p.barcode, p.name, p.name_kh, c.name AS category, p.price, p.cost, p.stock, p.status
          FROM tbl_products p LEFT JOIN tbl_categories c ON c.id = p.category_id
          WHERE ($1::int IS NULL OR p.tenant_id = $1) ORDER BY p.id`,
    columns: [['ID', 'id'], ['Barcode', 'barcode'], ['Name', 'name'], ['Name (KH)', 'name_kh'], ['Category', 'category'], ['Price', 'price'], ['Cost', 'cost'], ['Stock', 'stock'], ['Status', 'status']]
  },
  orders: {
    sql: `SELECT o.or_id, o.order_no, c.name AS customer, o.total, o.discount, o.payment_method, o.status, o.source, o.created_at
          FROM tbl_orders o LEFT JOIN tbl_customers c ON c.id = o.customer_id
          WHERE ($1::int IS NULL OR o.tenant_id = $1) AND NOT (o.status = ANY($2)) ORDER BY o.or_id DESC`,
    columns: [['ID', 'or_id'], ['Order No', 'order_no'], ['Customer', 'customer'], ['Total', 'total'], ['Discount', 'discount'], ['Payment', 'payment_method'], ['Status', 'status'], ['Source', 'source'], ['Created', 'created_at']],
    params: EXCLUDED_STATUSES
  },
  sales: {
    sql: `SELECT o.or_id, o.order_no, c.name AS customer, o.total, o.payment_method, o.status, o.created_at
          FROM tbl_orders o LEFT JOIN tbl_customers c ON c.id = o.customer_id
          WHERE ($1::int IS NULL OR o.tenant_id = $1) AND o.status = ANY($2) ORDER BY o.or_id DESC`,
    columns: [['ID', 'or_id'], ['Order No', 'order_no'], ['Customer', 'customer'], ['Total', 'total'], ['Payment', 'payment_method'], ['Status', 'status'], ['Created', 'created_at']],
    params: REVENUE_STATUSES
  },
  customers: {
    sql: `SELECT id, cus_id, name, phone, email, address, status, created_at FROM tbl_customers
          WHERE ($1::int IS NULL OR tenant_id = $1) ORDER BY id`,
    columns: [['ID', 'id'], ['Code', 'cus_id'], ['Name', 'name'], ['Phone', 'phone'], ['Email', 'email'], ['Address', 'address'], ['Status', 'status'], ['Created', 'created_at']]
  },
  stock: {
    sql: `SELECT p.id, p.barcode, p.name, s.qtyinstock, s.qtyavailable, s.qtyreserved, p.qty_alert
          FROM tbl_stock s JOIN tbl_products p ON p.id = s.productid
          WHERE ($1::int IS NULL OR s.tenant_id = $1) ORDER BY p.id`,
    columns: [['ID', 'id'], ['Barcode', 'barcode'], ['Name', 'name'], ['In stock', 'qtyinstock'], ['Available', 'qtyavailable'], ['Reserved', 'qtyreserved'], ['Alert level', 'qty_alert']]
  }
};

router.get('/export/:type', authenticate, async (req, res) => {
  try {
    const scope = getScope(req, res);
    if (!scope) return;
    const report = REPORTS[req.params.type];
    if (!report) {
      return res.status(400).json({ error: 'Unknown report type', supported: Object.keys(REPORTS) });
    }
    const queryParams = report.params ? [scope.tenantId, report.params] : [scope.tenantId];
    const { rows } = await pool.query(report.sql, queryParams);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(req.params.type);
    ws.columns = report.columns.map(([header, key]) => ({ header, key, width: 18 }));
    ws.getRow(1).font = { bold: true };
    rows.forEach((r) => ws.addRow(r));
    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=' + req.params.type + '-report.xlsx');
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('Report export error:', err.message);
    res.status(500).json({ error: 'Failed to export report' });
  }
});

module.exports = router;