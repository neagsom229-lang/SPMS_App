// backend/src/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();

// ============================================
// KHQR PAYMENT ENDPOINTS
// ============================================

// GET KHQR payment info
router.get('/khqr', async (req, res) => {
  const { amount, orderId } = req.query;

  // Validate
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Valid amount is required' });
  }
  if (!orderId) {
    return res.status(400).json({ error: 'Order ID is required' });
  }

  // Merchant info
  const merchantInfo = {
    name: "SAMNANG CHHEANG",
    account: "017530691",
    usdAccount: "017530690",
  };

  try {
    // Generate QR code (you can use a library or return static data)
    // For now, return merchant info
    res.json({
      merchantName: merchantInfo.name,
      khqrAccount: merchantInfo.account,
      usdAccount: merchantInfo.usdAccount,
      khqr: "YOUR_KHQR_DATA_HERE", // Replace with actual QR data
      amount: amount,
      orderId: orderId,
      expiresIn: 5 * 60, // 5 minutes
    });
  } catch (error) {
    console.error('❌ KHQR error:', error.message);
    res.status(500).json({ error: 'Failed to generate payment info' });
  }
});

// Check payment status
router.get('/status/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  // For now, return pending status
  res.json({
    success: true,
    status: 'pending',
    sessionId: sessionId,
    message: 'Payment status check'
  });
});

// Confirm payment
router.post('/confirm', (req, res) => {
  const { sessionId } = req.body;
  
  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID required' });
  }

  res.json({
    success: true,
    message: 'Payment confirmed successfully',
    sessionId: sessionId
  });
});

module.exports = router;