// backend/src/services/exportService.js
const ExcelJS = require('exceljs');

const exportToExcel = async (data, headers, filename) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sheet 1');

  // Add headers
  worksheet.addRow(headers);

  // Add data
  data.forEach(row => {
    worksheet.addRow(Object.values(row));
  });

  // Style headers
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD3D3D3' }
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

module.exports = { exportToExcel };