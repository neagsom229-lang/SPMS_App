const express = require('express');
const router = express.Router();
const axios = require('axios');
const pool = require('../config/db');

// GENERATE KHQR
const handleKhqrGeneration = async (req, res) => {
  const KHQR_TOKEN = process.env.KHQR_RBK_TOKEN;
  const amount = req.body?.amount || req.query?.amount;
  const planId = req.body?.planId || req.query?.plan || 'shophouse';
  const userId = req.body?.userId || req.query?.userId;
  const orderId = req.body?.orderId || req.query?.orderId || `sub-${userId}-${planId}-${Date.now()}`;

  if (!KHQR_TOKEN) {
    return res.status(500).json({ error: 'Missing KHQR_RBK_TOKEN in .env' });
  }
  if (!amount) {
    return res.status(400).json({ error: 'Missing amount' });
  }

  try {
    console.log(`Generating QR for $${amount}...`);

    // KHQR.dev Correct Endpoint & Payload
    const response = await axios.post(
      'https://api.khqr.dev/v1/qr',
      { amount: Number(amount) },
      {
        headers: {
          'Authorization': `Bearer ${KHQR_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const { qr, md5 } = response.data;

    // Save to DB
    await pool.query(
      `INSERT INTO khqr_sessions (order_id, user_id, plan, amount, md5, qr_string, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'UNPAID')
       ON CONFLICT (order_id) DO UPDATE SET md5 = EXCLUDED.md5, qr_string = EXCLUDED.qr_string, amount = EXCLUDED.amount`,
      [orderId, userId ? parseInt(userId, 10) : null, planId, Number(amount), md5, qr]
    );

    res.json({ qr, md5, orderId, amount: Number(amount) });
  } catch (error) {
    console.error('❌ KHQR API Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to generate KHQR', details: error.message });
  }
};

router.post('/khqr', handleKhqrGeneration);
router.get('/khqr', handleKhqrGeneration);

// CHECK STATUS
router.get('/khqr/status/:md5', async (req, res) => {
  const KHQR_TOKEN = process.env.KHQR_RBK_TOKEN;
  const { md5 } = req.params;

  try {
    const response = await axios.get(
      `https://api.khqr.dev/v1/qr/check/${md5}`,
      { headers: { 'Authorization': `Bearer ${KHQR_TOKEN}` } }
    );

    const status = String(response.data.status || '').toUpperCase();

    if (status === 'PAID') {
      const sessionResult = await pool.query(
        `UPDATE khqr_sessions SET status = 'PAID' WHERE md5 = $1 AND status != 'PAID' RETURNING user_id, plan`,
        [md5]
      );

      if (sessionResult.rows.length > 0) {
        const { user_id, plan } = sessionResult.rows[0];
        if (user_id) {
          await pool.query(
            `UPDATE tbl_users SET subscription_plan = $1, subscription_expires = NOW() + INTERVAL '30 days' WHERE userid = $2`,
            [plan, user_id]
          );
        }
      }
    }
    res.json({ status });
  } catch (error) {
    console.error('❌ KHQR Status Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

module.exports = router;
