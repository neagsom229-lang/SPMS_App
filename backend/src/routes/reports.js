// backend/src/routes/reports.js
const { exportToExcel } = require('../services/exportService');

app.get('/api/reports/export/products', async (req, res) => {
  const products = await db.query('SELECT * FROM tbl_products');
  const headers = ['ID', 'Name', 'Price', 'Stock'];
  const buffer = await exportToExcel(products.rows, headers, 'products');
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=products.xlsx');
  res.send(buffer);
});