/**
 * Export invoice as PDF
 */
export const exportInvoicePDF = (orderData, filename) => {
  return new Promise((resolve, reject) => {
    try {
      const printWindow = window.open('', '_blank', 'width=900,height=700,scrollbars=yes');
      if (!printWindow) {
        alert('Please allow pop-ups to print invoice');
        reject(new Error('Pop-up blocked'));
        return;
      }

      const items = orderData.items || [];
      const total = items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
      const discount = orderData.discount || 0;
      const grandTotal = total - discount;

      const itemsHtml = items.map(item => `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${item.product_name || 'Product'}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.qty || 0}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${(item.unit_price || 0).toFixed(2)}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${(item.subtotal || 0).toFixed(2)}</td>
        </tr>
      `).join('');

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Invoice ${orderData.order_no || 'INV-001'}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1f2937; background: white; }
              .header { border-bottom: 3px solid #6366f1; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
              .header h1 { color: #1f2937; font-size: 28px; margin: 0; }
              .header .sub { color: #6b7280; font-size: 14px; margin-top: 5px; }
              .header .order-no { font-size: 14px; color: #6b7280; }
              .info { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 20px; padding: 15px; background: #f9fafb; border-radius: 8px; }
              .info label { font-size: 11px; color: #6b7280; text-transform: uppercase; font-weight: 600; display: block; }
              .info .value { display: block; font-size: 14px; font-weight: 500; margin-top: 2px; color: #1f2937; }
              table { width: 100%; border-collapse: collapse; margin: 20px 0; }
              th { background: #f3f4f6; padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #374151; border-bottom: 2px solid #d1d5db; }
              td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
              .total-row { font-weight: bold; border-top: 2px solid #d1d5db; }
              .grand-total { font-size: 18px; color: #6366f1; }
              .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center; }
              .no-print { display: none; }
              @media print { body { padding: 20px; } .no-print { display: none; } }
            </style>
          </head>
          <body>
            <div class="header">
              <div>
                <h1>🧾 INVOICE</h1>
                <div class="sub">Order #${orderData.order_no || 'No order number'}</div>
              </div>
              <div class="order-no">Date: ${new Date().toLocaleDateString()}</div>
            </div>
            <div class="info">
              <div>
                <label>Customer</label>
                <span class="value">${orderData.customer_name || 'No customer'}</span>
              </div>
              <div>
                <label>Status</label>
                <span class="value">${orderData.status || 'No status recorded'}</span>
              </div>
              <div>
                <label>Payment Method</label>
                <span class="value">${orderData.payment_method || 'No payment recorded'}</span>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width: 40%;">Product</th>
                  <th style="width: 15%; text-align: center;">Qty</th>
                  <th style="width: 20%; text-align: right;">Price</th>
                  <th style="width: 25%; text-align: right;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
                <tr class="total-row">
                  <td colspan="3" style="text-align: right;">Subtotal:</td>
                  <td style="text-align: right;">$${total.toFixed(2)}</td>
                </tr>
                ${discount > 0 ? `
                  <tr>
                    <td colspan="3" style="text-align: right;">Discount:</td>
                    <td style="text-align: right;">-$${discount.toFixed(2)}</td>
                  </tr>
                ` : ''}
                <tr class="total-row">
                  <td colspan="3" style="text-align: right; font-size: 16px;">Grand Total:</td>
                  <td style="text-align: right; font-size: 20px; color: #6366f1; font-weight: bold;">$${grandTotal.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
            <div class="footer">
              <p>Thank you for your business!</p>
              <p style="font-size: 11px; margin-top: 5px;">This invoice is generated automatically. For questions, please contact support.</p>
            </div>
            <div class="no-print" style="text-align: center; margin-top: 20px; display: block !important;">
              <button onclick="window.print()" style="padding: 12px 40px; background: #6366f1; color: white; border: none; border-radius: 6px; font-size: 16px; cursor: pointer; margin-right: 10px;">
                🖨️ Print
              </button>
              <button onclick="window.close()" style="padding: 12px 40px; background: #6b7280; color: white; border: none; border-radius: 6px; font-size: 16px; cursor: pointer;">
                Close
              </button>
            </div>
          </body>
        </html>
      `;

      printWindow.document.write(html);
      printWindow.document.close();
      
      setTimeout(() => {
        printWindow.print();
        resolve(true);
      }, 1000);
      
    } catch (error) {
      console.error('❌ PDF export error:', error);
      reject(error);
    }
  });
};

/**
 * Export table as PDF
 */
export const exportToPDF = (tableId, filename = 'report.pdf') => {
  const table = document.getElementById(tableId);
  if (!table) {
    console.error('Table not found');
    return;
  }

  const printWindow = window.open('', '_blank', 'width=1000,height=800');
  if (!printWindow) {
    alert('Please allow pop-ups to export PDF');
    return;
  }

  const title = document.querySelector('h1')?.textContent || 'Report';
  const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1f2937; background: white; }
          .header { border-bottom: 3px solid #6366f1; padding-bottom: 15px; margin-bottom: 20px; }
          .header h1 { color: #1f2937; font-size: 24px; margin: 0; font-weight: 700; }
          .header .subtitle { color: #6b7280; margin: 5px 0 0 0; font-size: 14px; }
          .header .date { float: right; color: #6b7280; font-size: 14px; margin-top: -30px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th { background-color: #f3f4f6; padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #374151; border-bottom: 2px solid #d1d5db; }
          td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: left; font-size: 12px; }
          .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center; }
          .no-print { display: none; }
          @media print { body { padding: 20px; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="date">Generated: ${currentDate}</div>
          <h1>${title}</h1>
          <div class="subtitle">Report generated from Dashboard</div>
        </div>
        ${table.outerHTML}
        <div class="footer">
          <p>This report is generated automatically. For any questions, please contact support.</p>
          <p style="font-size: 11px;">Confidential - For internal use only</p>
        </div>
        <div class="no-print" style="text-align: center; margin-top: 20px;">
          <button onclick="window.print()" style="padding: 12px 40px; background: #6366f1; color: white; border: none; border-radius: 6px; font-size: 16px; cursor: pointer; margin-right: 10px;">
            🖨️ Print / Save as PDF
          </button>
          <button onclick="window.close()" style="padding: 12px 40px; background: #6b7280; color: white; border: none; border-radius: 6px; font-size: 16px; cursor: pointer;">
            Close
          </button>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
  
  setTimeout(() => {
    printWindow.print();
  }, 500);
};

/**
 * Export data as CSV
 */
export const exportToCSV = (data, filename = 'data.csv') => {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }

  const headers = Object.keys(data[0]);
  let csv = headers.join(',') + '\n';
  
  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header] || '';
      return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
    });
    csv += values.join(',') + '\n';
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};