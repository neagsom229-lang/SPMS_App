// backend/src/services/invoiceService.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Ensure invoices directory exists
const invoicesDir = path.join(__dirname, '../../invoices');
if (!fs.existsSync(invoicesDir)) {
  fs.mkdirSync(invoicesDir, { recursive: true });
}

const generateInvoice = (order, customer, items) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const filename = `invoice-${order.order_no}-${Date.now()}.pdf`;
      const filePath = path.join(invoicesDir, filename);
      
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Header
      doc.fontSize(24).font('Helvetica-Bold').text('INVOICE', { align: 'center' });
      doc.moveDown();

      // Company info
      doc.fontSize(10).font('Helvetica');
      doc.text('SPMS System', 50, 100);
      doc.text('123 Business Street', 50, 115);
      doc.text('Phnom Penh, Cambodia', 50, 130);
      doc.text('Phone: +855 12 345 678', 50, 145);
      
      // Order info - right side
      doc.text(`Invoice #: ${order.order_no}`, 400, 100);
      doc.text(`Date: ${new Date(order.order_date).toLocaleDateString()}`, 400, 115);
      doc.text(`Status: ${order.status}`, 400, 130);
      
      // Customer info
      doc.moveDown(2);
      doc.font('Helvetica-Bold').text('Bill To:', 50, 200);
      doc.font('Helvetica');
      doc.text(`${customer.first_name} ${customer.last_name}`, 50, 215);
      if (customer.e_mail) doc.text(`Email: ${customer.e_mail}`, 50, 230);
      if (customer.phone) doc.text(`Phone: ${customer.phone}`, 50, 245);
      
      doc.moveDown(2);

      // Table headers
      const tableTop = 320;
      doc.font('Helvetica-Bold');
      doc.text('Product', 50, tableTop);
      doc.text('Qty', 250, tableTop);
      doc.text('Price', 350, tableTop);
      doc.text('Total', 450, tableTop);
      
      // Draw header line
      doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
      
      // Table rows
      let y = tableTop + 30;
      doc.font('Helvetica');
      
      const itemsArray = items || [];
      itemsArray.forEach((item, i) => {
        const itemName = item.product_name || 'Product';
        doc.text(itemName.length > 30 ? itemName.substring(0, 27) + '...' : itemName, 50, y + (i * 25));
        doc.text(item.qty_order.toString(), 250, y + (i * 25));
        doc.text(`$${parseFloat(item.price).toFixed(2)}`, 350, y + (i * 25));
        doc.text(`$${parseFloat(item.subtotal).toFixed(2)}`, 450, y + (i * 25));
      });

      // Total
      const totalY = y + (itemsArray.length * 25) + 30;
      doc.moveTo(50, totalY - 10).lineTo(550, totalY - 10).stroke();
      doc.font('Helvetica-Bold');
      doc.text(`Total: $${parseFloat(order.amount_us).toFixed(2)}`, 400, totalY);
      
      // Footer
      doc.moveDown(4);
      doc.fontSize(10).font('Helvetica');
      doc.text('Thank you for your business!', 50, 700, { align: 'center' });
      doc.text('Payment due within 30 days', 50, 720, { align: 'center' });

      doc.end();

      stream.on('finish', () => {
        resolve({
          filename: filename,
          path: filePath,
          url: `/invoices/${filename}`
        });
      });

      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = { generateInvoice };