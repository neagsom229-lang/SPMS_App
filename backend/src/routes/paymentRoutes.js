// backend/src/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, requireTenant, requireSuperAdmin } = require('../middleware/auth');
const { BakongKHQR, IndividualInfo, khqrData } = require('bakong-khqr');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { verifyTransaction } = require('../services/bakongVerifier');
const PLANS = require('../config/plans');

// 1. GET Subscription info
router.get('/subscription', authenticate, requireTenant, async (req, res) => {
  try {
    const tenantRes = await db.query(
      `SELECT plan, plan_expires_at FROM tenants WHERE id = $1`,
      [req.tenantId]
    );
    const tenant = tenantRes.rows[0] || { plan: 'FREE', plan_expires_at: null };
    res.json({
      success: true,
      plan: tenant.plan || 'FREE',
      expires: tenant.plan_expires_at
    });
  } catch (err) {
    console.error('Error fetching subscription:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. Create KHQR (Server-side price, no body amount, required BAKONG_ACCOUNT_ID)
router.post('/bakong/create-qr', authenticate, requireTenant, async (req, res) => {
  try {
    const merchantId = process.env.BAKONG_ACCOUNT_ID;
    if (!merchantId) {
      console.error('❌ BAKONG_ACCOUNT_ID is not configured');
      return res.status(503).json({ error: 'Payment gateway not configured' });
    }

    const merchantName = process.env.BAKONG_MERCHANT_NAME || 'SPMS Store';
    const merchantCity = process.env.BAKONG_MERCHANT_CITY || 'Phnom Penh';

    if (process.env.NODE_ENV === 'production' && process.env.PLANS_CONFIRMED !== 'true') {
      console.error('❌ PLANS_CONFIRMED must be true in production');
      return res.status(503).json({ error: 'Subscription pricing not confirmed for production' });
    }

    const { plan = 'PRO', period_months = 1, currency = 'USD' } = req.body;
    const normPlan = String(plan).toUpperCase();
    const normCurr = String(currency).toUpperCase();
    const months = Number(period_months);

    if (months >= 120 || !PLANS[normPlan] || !PLANS[normPlan][months] || !PLANS[normPlan][months][normCurr]) {
      return res.status(400).json({ error: 'Invalid plan, period, or currency combination' });
    }

    const expectedAmount = PLANS[normPlan][months][normCurr];
    const orderId = `SUB-${req.tenantId}-${Date.now()}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const info = new IndividualInfo(
      merchantId,
      merchantName,
      merchantCity,
      Number(expectedAmount),
      normCurr === 'KHR' ? khqrData.currency.khr : khqrData.currency.usd,
      orderId,
      'SPMS Subscription'
    );

    const khqr = new BakongKHQR();
    const qrResult = khqr.generateIndividual(info);

    if (qrResult.status.code !== 0 || !qrResult.data) {
      return res.status(500).json({ error: 'Failed to generate KHQR string' });
    }

    const qrString = qrResult.data.qr;
    const md5 = qrResult.data.md5;
    const qrImage = await QRCode.toDataURL(qrString);

    await db.query(
      `INSERT INTO khqr_sessions (tenant_id, user_id, plan, period_months, amount, expected_amount, currency, md5, qr_string, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, 'PENDING', $9)
       ON CONFLICT (md5) DO NOTHING`,
      [req.tenantId, req.user.userId, normPlan, months, expectedAmount, normCurr, md5, qrString, expiresAt]
    );

    res.json({
      success: true,
      qrString,
      qrImage,
      md5,
      expires_at: expiresAt,
      amount: expectedAmount,
      currency: normCurr
    });
  } catch (err) {
    console.error('Error creating KHQR session:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. Check KHQR session status
router.get('/bakong/check/:md5', authenticate, requireTenant, async (req, res) => {
  try {
    const { md5 } = req.params;
    if (!md5 || !/^[a-f0-9]{32}$/.test(md5)) {
      return res.status(400).json({ error: 'Invalid MD5 format' });
    }

    const sessionRes = await db.query(
      `SELECT * FROM khqr_sessions WHERE md5 = $1 AND tenant_id = $2`,
      [md5, req.tenantId]
    );

    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionRes.rows[0];
    const now = new Date();

    if (session.status === 'PAID') {
      return res.json({ status: 'PAID', plan: session.plan, expires_at: session.expires_at });
    }

    if (session.status === 'EXPIRED') {
      return res.json({ status: 'EXPIRED' });
    }

    const verifyResult = await verifyTransaction(session, md5);

    if (verifyResult.state === 'PAID') {
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        const updateRes = await client.query(
          `UPDATE khqr_sessions 
           SET status = 'PAID', bakong_hash = $2, paid_at = NOW(), verified_by = 'bakong', raw_response = $3 
           WHERE md5 = $1 AND status = 'PENDING' 
           RETURNING *`,
          [md5, verifyResult.hash, JSON.stringify(verifyResult.raw || {})]
        );

        let isWinner = updateRes.rowCount > 0;

        if (isWinner) {
          const months = session.period_months || 1;
          await client.query(
            `UPDATE tenants 
             SET plan = $1, 
                 plan_expires_at = COALESCE(GREATEST(plan_expires_at, NOW()), NOW()) + make_interval(months => $2) 
             WHERE id = $3`,
            [session.plan || 'PRO', months, req.tenantId]
          );

          await client.query(
            `INSERT INTO tbl_activity_logs (tenant_id, user_id, action, details) VALUES ($1, $2, $3, $4)`,
            [req.tenantId, req.user.userId, 'SUBSCRIPTION_PAID', JSON.stringify({ plan: session.plan, hash: verifyResult.hash })]
          );
        }

        await client.query('COMMIT');
        return res.json({ status: 'PAID', plan: session.plan });
      } catch (txErr) {
        await client.query('ROLLBACK');
        console.error('Error committing verified payment transaction:', txErr);
        return res.json({ status: 'VERIFYING_ERROR' });
      } finally {
        client.release();
      }
    } else if (verifyResult.state === 'FAILED_MISMATCH') {
      await db.query(`UPDATE khqr_sessions SET status = 'FAILED_MISMATCH' WHERE id = $1`, [session.id]);
      return res.json({ status: 'VERIFYING_ERROR' });
    } else if (verifyResult.state === 'ERROR') {
      return res.json({ status: 'VERIFYING_ERROR' });
    } else {
      if (session.expires_at && new Date(session.expires_at) < now) {
        await db.query(`UPDATE khqr_sessions SET status = 'EXPIRED' WHERE id = $1 AND status = 'PENDING'`, [session.id]);
        return res.json({ status: 'EXPIRED' });
      }
      return res.json({ status: 'PENDING' });
    }

  } catch (err) {
    console.error('Error checking KHQR status:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. Webhook Endpoint (Relay)
router.post('/webhook/khqr', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === 'object' ? JSON.stringify(req.body) : String(req.body || ''));
    const signature = req.headers['x-khqr-signature'] || req.headers['x-signature'] || '';
    const timestampHeader = req.headers['x-khqr-timestamp'] || req.headers['x-timestamp'] || '';
    const webhookSecret = process.env.KHQR_WEBHOOK_SECRET || 'secret';

    if (timestampHeader) {
      const eventTime = Number(timestampHeader);
      const now = Date.now();
      if (isNaN(eventTime) || Math.abs(now - eventTime) > 300000) {
        return res.status(401).json({ error: 'Invalid or expired timestamp' });
      }
    }

    const hmac = crypto.createHmac('sha256', webhookSecret);
    hmac.update(rawBody);
    const computedSignature = hmac.digest('hex');

    const sigBuffer = Buffer.from(signature, 'utf8');
    const computedBuffer = Buffer.from(computedSignature, 'utf8');

    if (sigBuffer.length !== computedBuffer.length || !crypto.timingSafeEqual(sigBuffer, computedBuffer)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON' });
    }

    const eventId = payload.eventId || payload.id || payload.md5;
    if (!eventId) {
      return res.status(400).json({ error: 'Missing event identifier' });
    }

    // Idempotency check
    const eventRes = await db.query(`SELECT event_id FROM khqr_webhook_events WHERE event_id = $1`, [eventId]);
    if (eventRes.rows.length > 0) {
      return res.status(200).json({ success: true, message: 'Event already processed' });
    }

    await db.query(`INSERT INTO khqr_webhook_events (event_id) VALUES ($1) ON CONFLICT (event_id) DO NOTHING`, [eventId]);

    const md5 = payload.md5;
    if (!md5) {
      return res.status(200).json({ success: true, message: 'No md5 in payload' });
    }

    const sessionRes = await db.query(`SELECT * FROM khqr_sessions WHERE md5 = $1`, [md5]);
    if (sessionRes.rows.length === 0) {
      return res.status(200).json({ success: true, message: 'Session not found' });
    }

    const session = sessionRes.rows[0];
    if (session.status === 'PAID') {
      return res.status(200).json({ success: true, message: 'Already paid' });
    }

    // Re-verify with provider check endpoint
    const verifyResult = await verifyTransaction(session, md5);
    if (verifyResult.state === 'PAID') {
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        const updateRes = await client.query(
          `UPDATE khqr_sessions 
           SET status = 'PAID', bakong_hash = $2, paid_at = NOW(), verified_by = 'webhook', raw_response = $3 
           WHERE md5 = $1 AND status = 'PENDING' 
           RETURNING *`,
          [md5, verifyResult.hash, JSON.stringify(verifyResult.raw || {})]
        );

        if (updateRes.rowCount > 0) {
          const months = session.period_months || 1;
          await client.query(
            `UPDATE tenants 
             SET plan = $1, 
                 plan_expires_at = COALESCE(GREATEST(plan_expires_at, NOW()), NOW()) + make_interval(months => $2) 
             WHERE id = $3`,
            [session.plan || 'PRO', months, session.tenant_id]
          );

          await client.query(
            `INSERT INTO tbl_activity_logs (tenant_id, user_id, action, details) VALUES ($1, $2, $3, $4)`,
            [session.tenant_id, session.user_id, 'SUBSCRIPTION_WEBHOOK_PAID', JSON.stringify({ plan: session.plan, hash: verifyResult.hash })]
          );
        }

        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK');
        console.error('Webhook transaction error:', txErr);
      } finally {
        client.release();
      }
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Locked legacy aliases (cannot set PAID)
router.get('/status/:id', authenticate, requireTenant, (req, res) => {
  res.status(410).json({ error: 'Endpoint deprecated. Use /bakong/check/:md5' });
});
router.get('/khqr', authenticate, requireTenant, (req, res) => {
  res.status(410).json({ error: 'Endpoint deprecated' });
});
router.post('/confirm', authenticate, requireTenant, (req, res) => {
  res.status(410).json({ error: 'Endpoint deprecated' });
});

// 5. Simulator Route (Disabled in production)
router.post('/simulate-payment/:md5', authenticate, requireSuperAdmin, async (req, res) => {
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_PAYMENT_SIMULATOR !== 'true') {
    return res.status(404).json({ error: 'Not Found' });
  }
  try {
    const { md5 } = req.params;
    const sessionRes = await db.query(`SELECT * FROM khqr_sessions WHERE md5 = $1`, [md5]);
    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const session = sessionRes.rows[0];

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const simulatedHash = 'SIM-' + crypto.randomBytes(8).toString('hex');
      const updateRes = await client.query(
        `UPDATE khqr_sessions SET status = 'PAID', bakong_hash = $2, paid_at = NOW(), verified_by = $3, raw_response = $4 WHERE md5 = $1 AND status = 'PENDING' RETURNING *`,
        [md5, simulatedHash, `manual:${req.user.userId}`, JSON.stringify({ simulated: true })]
      );

      if (updateRes.rowCount > 0) {
        const months = session.period_months || 1;
        await client.query(
          `UPDATE tenants 
           SET plan = $1, 
               plan_expires_at = COALESCE(GREATEST(plan_expires_at, NOW()), NOW()) + make_interval(months => $2) 
           WHERE id = $3`,
          [session.plan || 'PRO', months, session.tenant_id]
        );
        await client.query(`INSERT INTO tbl_activity_logs (tenant_id, user_id, action, details) VALUES ($1, $2, $3, $4)`,
          [session.tenant_id, req.user.userId, 'SUBSCRIPTION_SIMULATED', JSON.stringify({ plan: session.plan, hash: simulatedHash })]);
      }

      await client.query('COMMIT');
      res.json({ success: true, status: 'PAID' });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error in simulation:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 6. Super Admin Endpoints
router.get('/admin/sessions', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { status, q } = req.query;
    let query = `SELECT k.*, t.name as tenant_name FROM khqr_sessions k LEFT JOIN tenants t ON k.tenant_id = t.id WHERE 1=1`;
    const params = [];
    let idx = 1;

    if (status) {
      query += ` AND k.status = $${idx++}`;
      params.push(status);
    }
    if (q) {
      query += ` AND (k.md5 ILIKE $${idx} OR k.order_id ILIKE $${idx} OR t.name ILIKE $${idx})`;
      params.push(`%${q}%`);
      idx++;
    }

    query += ` ORDER BY k.created_at DESC LIMIT 100`;
    const result = await db.query(query, params);
    res.json({ success: true, sessions: result.rows });
  } catch (err) {
    console.error('Error listing admin sessions:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/admin/sessions/:id/recheck', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const sessionRes = await db.query(`SELECT * FROM khqr_sessions WHERE id = $1`, [id]);
    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const session = sessionRes.rows[0];
    const verifyResult = await verifyTransaction(session, session.md5);
    res.json({ success: true, verifyResult });
  } catch (err) {
    console.error('Error rechecking admin session:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/admin/sessions/:id/mark-paid', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ error: 'Reason is required for manual mark-paid' });
    }

    const sessionRes = await db.query(`SELECT * FROM khqr_sessions WHERE id = $1`, [id]);
    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const session = sessionRes.rows[0];

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const manualHash = 'MANUAL-' + crypto.randomBytes(8).toString('hex');
      const updateRes = await client.query(
        `UPDATE khqr_sessions SET status = 'PAID', bakong_hash = $2, paid_at = NOW(), verified_by = $3, raw_response = $4 WHERE id = $1 AND status != 'PAID' RETURNING *`,
        [id, manualHash, `manual:${req.user.userId}`, JSON.stringify({ reason, marked_by: req.user.userId })]
      );

      if (updateRes.rowCount > 0) {
        const months = session.period_months || 1;
        await client.query(
          `UPDATE tenants 
           SET plan = $1, 
               plan_expires_at = COALESCE(GREATEST(plan_expires_at, NOW()), NOW()) + make_interval(months => $2) 
           WHERE id = $3`,
          [session.plan || 'PRO', months, session.tenant_id]
        );
        await client.query(`INSERT INTO tbl_activity_logs (tenant_id, user_id, action, details) VALUES ($1, $2, $3, $4)`,
          [session.tenant_id, req.user.userId, 'SUBSCRIPTION_MANUAL_PAID', JSON.stringify({ plan: session.plan, reason, hash: manualHash })]);
      }

      await client.query('COMMIT');
      res.json({ success: true, status: 'PAID' });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error marking session as paid:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
