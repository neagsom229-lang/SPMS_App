// backend/src/routes/payment.js
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { BakongKHQR, khqrData, IndividualInfo } = require('bakong-khqr');

// Ensure table exists helper function
async function ensureKhqrTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS khqr_sessions (
        id SERIAL PRIMARY KEY,
        order_id VARCHAR(255) UNIQUE NOT NULL,
        user_id INTEGER REFERENCES tbl_users(userid) ON DELETE CASCADE,
        plan VARCHAR(100),
        amount NUMERIC(10, 2) NOT NULL,
        md5 VARCHAR(255) UNIQUE NOT NULL,
        qr_string TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'UNPAID',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        paid_at TIMESTAMP
      )
    `);
  } catch (err) {
    console.error('❌ Failed to ensure khqr_sessions table:', err.message);
  }
}

// 1. CREATE DYNAMIC QR ROUTE (POST /api/payment/bakong/create-qr)
router.post('/bakong/create-qr', async (req, res) => {
  const { amount, planId, userId } = req.body;

  try {
    if (!amount || !userId) {
      return res.status(400).json({ error: 'Missing required parameters: amount and userId' });
    }

    const rawOrderId = `sub-${userId}-${planId || 'default'}-${Date.now()}`;
    const orderId = rawOrderId.slice(0, 25);

    const accountId = process.env.BAKONG_ACCOUNT_ID || 'abaakhppxxx@abaa';
    const merchantName = process.env.BAKONG_MERCHANT_NAME || 'SAMNANG CHHEANG';
    const merchantCity = process.env.BAKONG_MERCHANT_CITY || 'Phnom Penh';

    const optionalData = {
      amount: Number(amount),
      currency: khqrData.currency.usd,
      billNumber: orderId,
      expirationTimestamp: Date.now() + 15 * 60 * 1000 // 15 minutes
    };

    const individualInfo = new IndividualInfo(
      accountId,
      merchantName,
      merchantCity,
      optionalData
    );

    const khqr = new BakongKHQR();
    const response = khqr.generateIndividual(individualInfo);

    if (!response || !response.data) {
      console.error('KHQR Library Error Response:', response);
      throw new Error('Failed to generate KHQR string from library');
    }

    const qrString = response.data.qr;
    const md5 = response.data.md5;

    await ensureKhqrTable();

    // Save to database with status 'UNPAID'
    await pool.query(
      `INSERT INTO khqr_sessions (order_id, user_id, plan, amount, md5, qr_string, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'UNPAID')
       ON CONFLICT (order_id) DO UPDATE SET md5 = EXCLUDED.md5, qr_string = EXCLUDED.qr_string, amount = EXCLUDED.amount`,
      [orderId, parseInt(userId, 10), planId || 'default', Number(amount), md5, qrString]
    );

    res.json({ success: true, qr: qrString, md5, orderId });
  } catch (error) {
    console.error('❌ BAKONG CREATE QR FATAL ERROR:', error.message);
    res.status(500).json({ error: error.message || 'Failed to generate dynamic QR' });
  }
});

// 2. STATUS CHECK ROUTE (GET /api/payment/bakong/check/:md5)
router.get('/bakong/check/:md5', async (req, res) => {
  const { md5 } = req.params;

  try {
    const result = await pool.query(
      `SELECT status, user_id, plan FROM khqr_sessions WHERE md5 = $1`,
      [md5]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction session not found' });
    }

    const session = result.rows[0];
    const status = session.status;

    // If PAID, update user subscription in tbl_users
    if (status === 'PAID') {
      try {
        await pool.query(
          `UPDATE tbl_users
           SET subscription_plan = $1, subscription_expires = NOW() + INTERVAL '30 days'
           WHERE userid = $2`,
          [session.plan || 'Standard', session.user_id]
        );
      } catch (subErr) {
        console.error('❌ Failed to update user subscription:', subErr.message);
      }
      return res.json({ status: 'PAID' });
    }

    res.json({ status: status || 'UNPAID' });
  } catch (error) {
    console.error('❌ Status Check Error:', error.message);
    res.status(500).json({ error: 'Database error checking payment status' });
  }
});

// 3. SIMULATE PAYMENT SUCCESS (For Testing / Dev)
router.post('/bakong/simulate-payment/:md5', async (req, res) => {
  const { md5 } = req.params;
  try {
    const sessionRes = await pool.query(
      `SELECT user_id, plan FROM khqr_sessions WHERE md5 = $1`,
      [md5]
    );

    await pool.query(
      `UPDATE khqr_sessions SET status = 'PAID', paid_at = NOW() WHERE md5 = $1`,
      [md5]
    );

    if (sessionRes.rows.length > 0) {
      const { user_id, plan } = sessionRes.rows[0];
      await pool.query(
        `UPDATE tbl_users
         SET subscription_plan = $1, subscription_expires = NOW() + INTERVAL '30 days'
         WHERE userid = $2`,
        [plan || 'Standard', user_id]
      );
    }

    res.json({ success: true, message: "Payment simulated as PAID and subscription updated" });
  } catch (error) {
    console.error('Simulation error:', error.message);
    res.status(500).json({ error: 'Failed to simulate payment' });
  }
});

module.exports = router;
