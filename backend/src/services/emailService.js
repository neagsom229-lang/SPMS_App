const nodemailer = require('nodemailer');

// Configure email transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || 'your-email@gmail.com',
      pass: process.env.EMAIL_PASS || 'your-app-password',
    },
  });
};

const sendOrderConfirmation = async (order, customer) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_USER || 'your-email@gmail.com',
      to: customer?.email || customer?.e_mail || 'customer@email.com',
      subject: `Order Confirmation - ${order.order_no}`,
      html: `
        <h2>Order Confirmation</h2>
        <p>Thank you for your order!</p>
        <p><strong>Order #:</strong> ${order.order_no}</p>
        <p><strong>Date:</strong> ${new Date(order.order_date).toLocaleDateString()}</p>
        <p><strong>Total:</strong> $${order.net_amount.toFixed(2)}</p>
        <p><strong>Status:</strong> ${order.status}</p>
        <p>We will notify you when your order is processed.</p>
        <br/>
        <p>Thank you for your business!</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Email sent to:', customer?.email || customer?.e_mail);
    return { success: true, message: 'Email sent' };
  } catch (error) {
    console.error('❌ Email error:', error.message);
    return { success: false, message: error.message };
  }
};

const sendLowStockAlert = async (products) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_USER || 'your-email@gmail.com',
      to: process.env.ADMIN_EMAIL || 'admin@email.com',
      subject: '⚠️ Low Stock Alert',
      html: `
        <h2>Low Stock Alert</h2>
        <p>The following products are running low:</p>
        <ul>
          ${products.map(p => `<li>${p.name_en}: ${p.qty_available} left</li>`).join('')}
        </ul>
        <p>Please restock these items.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Low stock alert sent');
  } catch (error) {
    console.error('❌ Email error:', error.message);
  }
};

module.exports = { sendOrderConfirmation, sendLowStockAlert };