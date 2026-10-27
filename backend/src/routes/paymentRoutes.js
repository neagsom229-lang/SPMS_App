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
  if (!ADMIN_SECRET || !provided) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const expectedBuffer = Buffer.from(ADMIN_SECRET);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

const SESSION_TTL_MS = 5 * 60 * 1000;

// GET KHQR payment info — creates a new payment session in DB
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

  const tenantId = req.user.tenantId || null;

  try {
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await db.query(
      `INSERT INTO khqr_sessions (session_id, tenant_id, order_id, amount, status, expires_at)
       VALUES ($1, $2, $3, $4, 'pending', $5)`,
      [sessionId, tenantId, orderId, numericAmount, expiresAt]
    );

    const khqrPayload =
      '00020101021129450016abaakhppxxx@abaa01090175306910208ABA Bank40600006abaP2P01125BFE57575374020901753069103090175306900404Dual5204000053031165802KH5915SAMNANG CHHEANG6010Phnom Penh630437F4';

    const khqrImage = await QRCode.toDataURL(khqrPayload, {
      width: 320,
      margin: 1,
    });

    res.json({
      sessionId,
      merchantName: 'SAMNANG CHHEANG',
      khqrAccount: '017530691',
      usdAccount: '017530690',
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
router.post('/confirm', authenticate, async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID required' });
  }

  try {
    const sessionRes = await db.query('SELECT * FROM khqr_sessions WHERE session_id = $1', [sessionId]);
    if (sessionRes.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    const session = sessionRes.rows[0];

    if (new Date() > new Date(session.expires_at)) {
      await db.query("UPDATE khqr_sessions SET status = 'expired' WHERE session_id = $1", [sessionId]);
      return res.status(400).json({ success: false, message: 'This QR code has expired' });
    }

    await db.query("UPDATE khqr_sessions SET status = 'awaiting_verification' WHERE session_id = $1", [sessionId]);

    res.json({
      success: true,
      status: 'awaiting_verification',
      message: 'Thanks — we are verifying your payment and will activate your plan shortly.',
    });
  } catch (error) {
    console.error('❌ Confirm payment error:', error.message);
    res.status(500).json({ error: 'Failed to confirm payment' });
  }
});

// List sessions waiting for review
router.get('/admin/pending', requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM khqr_sessions WHERE status IN ('awaiting_verification', 'pending') AND expires_at > NOW() ORDER BY created_at DESC`
    );
    res.json({ sessions: result.rows });
  } catch (error) {
    console.error('❌ Admin pending sessions error:', error.message);
    res.status(500).json({ error: 'Failed to fetch pending sessions' });
  }
});

// List ALL sessions
router.get('/admin/all', requireAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM khqr_sessions ORDER BY created_at DESC');
    res.json({ sessions: result.rows });
  } catch (error) {
    console.error('❌ Admin all sessions error:', error.message);
    res.status(500).json({ error: 'Failed to fetch all sessions' });
  }
});

// Check payment status
router.get('/status/:sessionId', authenticate, async (req, res) => {
  const { sessionId } = req.params;
  try {
    const sessionRes = await db.query('SELECT * FROM khqr_sessions WHERE session_id = $1', [sessionId]);
    if (sessionRes.rowCount === 0) {
      return res.status(404).json({ success: false, status: 'expired', message: 'Session not found' });
    }
    const session = sessionRes.rows[0];

    let status = session.status;
    if (new Date() > new Date(session.expires_at) && status !== 'paid') {
      status = 'expired';
      await db.query("UPDATE khqr_sessions SET status = 'expired' WHERE session_id = $1", [sessionId]);
    }

    res.json({ success: true, status, sessionId: session.session_id });
  } catch (error) {
    console.error('❌ Status check error:', error.message);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

// Verify payment and activate subscription
router.post('/verify/:sessionId', requireAdmin, async (req, res) => {
  const { sessionId } = req.params;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const sessionRes = await client.query('SELECT * FROM khqr_sessions WHERE session_id = $1 FOR UPDATE', [sessionId]);
    if (sessionRes.rowCount === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    const session = sessionRes.rows[0];

    if (session.status === 'paid') {
      await client.query('COMMIT');
      client.release();
      return res.json({ success: true, status: 'paid', message: 'Already marked paid' });
    }

    if (session.order_id) {
      await client.query("UPDATE tbl_payment SET status = 'COMPLETED' WHERE order_id = $1", [session.order_id]);
      await client.query("UPDATE tbl_orders SET status = 'Completed', updated_at = NOW() WHERE or_id = $1", [session.order_id]);
    }

    await client.query("UPDATE khqr_sessions SET status = 'paid' WHERE session_id = $1", [sessionId]);
    await client.query('COMMIT');
    client.release();

    res.json({ success: true, status: 'paid', orderId: session.order_id });
  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    console.error('❌ Verification error:', error.message);
    res.status(500).json({ success: false, message: 'Activation failed' });
  }
});

// Reject/expire a session manually
router.post('/admin/reject/:sessionId', requireAdmin, async (req, res) => {
  const { sessionId } = req.params;
  try {
    await db.query("UPDATE khqr_sessions SET status = 'expired' WHERE session_id = $1", [sessionId]);
    res.json({ success: true, status: 'expired' });
  } catch (error) {
    console.error('❌ Reject session error:', error.message);
    res.status(500).json({ error: 'Failed to reject session' });
  }
});

module.exports = router;
