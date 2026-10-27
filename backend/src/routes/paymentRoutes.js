// backend/src/routes/paymentRoutes.js
const express = require('express');
const crypto = require('crypto');
const QRCode = require('qrcode');
const router = express.Router();

const db = require('../config/postgres');
const { authenticate } = require('../middleware/auth');

const ADMIN_SECRET = process.env.ADMIN_SECRET;
if (!ADMIN_SECRET) {
  console.warn('⚠️  ADMIN_SECRET is not set — admin/verify payment routes are UNPROTECTED. Set it before deploying.');
}

const requireAdmin = (req, res, next) => {
  const provided = req.headers['x-admin-secret'];
  if (!ADMIN_SECRET || provided !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

const sessions = new Map();
const SESSION_TTL_MS = 5 * 60 * 1000;

const pruneExpiredSessions = () => {
  const now = Date.now();
  for (const [id, s] of sessions.entries()) {
    if (now > s.expiresAt && s.status !== 'paid') s.status = 'expired';
  }
};

// ============================================
// STATIC ROUTES FIRST
// ============================================

// GET KHQR payment info — creates a new payment session
router.get('/khqr', authenticate, async (req, res) => {
  const { amount, orderId, userId, plan } = req.query;

  const numericAmount = Number(amount);
  if (!amount || !Number.isFinite(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ error: 'Valid amount is required' });
  }
  if (!orderId) {
    return res.status(400).json({ error: 'Order ID is required' });
  }
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  if (!plan) {
    return res.status(400).json({ error: 'plan is required' });
  }

  if (!req.user.isSuperAdmin && String(req.user.userId) !== String(userId)) {
    return res.status(403).json({ error: 'Cannot create a payment session for another user' });
  }

  pruneExpiredSessions();

  const merchantInfo = {
    name: 'SAMNANG CHHEANG',
    account: '017530691',
    usdAccount: '017530690',
  };

  try {
    const sessionId = crypto.randomUUID();
    const expiresAt = Date.now() + SESSION_TTL_MS;

    sessions.set(sessionId, {
      sessionId,
      orderId: String(orderId),
      amount: numericAmount,
      userId: String(userId),
      plan: String(plan),
      status: 'pending',
      createdAt: Date.now(),
      expiresAt,
    });

    const khqrPayload =
      '00020101021129450016abaakhppxxx@abaa01090175306910208ABA Bank40600006abaP2P01125BFE57575374020901753069103090175306900404Dual5204000053031165802KH5915SAMNANG CHHEANG6010Phnom Penh630437F4';

    const khqrImage = await QRCode.toDataURL(khqrPayload, {
      width: 320,
      margin: 1,
    });

    res.json({
      sessionId,
      merchantName: merchantInfo.name,
      khqrAccount: merchantInfo.account,
      usdAccount: merchantInfo.usdAccount,
      khqr: khqrPayload,
      khqrImage,
      amount: numericAmount,
      orderId: String(orderId),
      expiresIn: SESSION_TTL_MS / 1000,
    });
  } catch (error) {
    console.error('❌ KHQR error:', error.message);
    res.status(500).json({ error: 'Failed to generate payment info' });
  }
});

// Manual "I Have Paid" click from the customer.
router.post('/confirm', authenticate, (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID required' });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session expired or not found' });
  }

  if (!req.user.isSuperAdmin && String(session.userId) !== String(req.user.userId)) {
    return res.status(403).json({ success: false, message: 'Not your session' });
  }

  if (Date.now() > session.expiresAt) {
    session.status = 'expired';
    return res.status(400).json({ success: false, message: 'This QR code has expired' });
  }

  session.status = 'awaiting_verification';

  res.json({
    success: true,
    status: session.status,
    message: 'Thanks — we are verifying your payment and will activate your plan shortly.',
  });
});

// List sessions waiting for review
router.get('/admin/pending', requireAdmin, (req, res) => {
  pruneExpiredSessions();
  const pending = Array.from(sessions.values())
    .filter((s) => s.status === 'awaiting_verification' || s.status === 'pending')
    .sort((a, b) => b.createdAt - a.createdAt);
  res.json({ sessions: pending });
});

// List ALL sessions
router.get('/admin/all', requireAdmin, (req, res) => {
  pruneExpiredSessions();
  const all = Array.from(sessions.values()).sort((a, b) => b.createdAt - a.createdAt);
  res.json({ sessions: all });
});

// ============================================
// PARAMETERIZED ROUTES LAST
// ============================================

// Check payment status
router.get('/status/:sessionId', authenticate, (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({
      success: false,
      status: 'expired',
      message: 'Session not found or already expired',
    });
  }

  if (!req.user.isSuperAdmin && String(session.userId) !== String(req.user.userId)) {
    return res.status(403).json({ success: false, message: 'Not your session' });
  }

  if (Date.now() > session.expiresAt && session.status !== 'paid') {
    session.status = 'expired';
  }

  res.json({
    success: true,
    status: session.status,
    sessionId: session.sessionId,
  });
});

// Verify payment and activate subscription
router.post('/verify/:sessionId', requireAdmin, async (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  if (session.status === 'paid') {
    return res.json({ success: true, status: 'paid', message: 'Already marked paid' });
  }

  try {
    await db.query(
      `UPDATE tbl_users 
       SET subscription_plan = $1, 
           subscription_status = 'active', 
           subscription_updated_at = NOW() 
       WHERE userid = $2`,
      [session.plan, session.userId]
    );

    session.status = 'paid';
    res.json({ success: true, status: session.status, orderId: session.orderId });
  } catch (error) {
    console.error('❌ Activation error for session', sessionId, error);
    res.status(500).json({
      success: false,
      message: 'Payment was NOT marked paid — activation failed. Check server logs.',
    });
  }
});

// Reject/expire a session manually
router.post('/admin/reject/:sessionId', requireAdmin, (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  session.status = 'expired';
  res.json({ success: true, status: session.status });
});

module.exports = router;
