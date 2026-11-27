// backend/src/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../config/postgres');
const { authenticate, requireTenant, requireSuperAdmin } = require('../middleware/auth');
const { BakongKHQR, IndividualInfo, khqrData } = require('bakong-khqr');
const QRCode = require('qrcode');
const crypto = require('crypto');
const PLANS = require('../config/plans');

// Human-readable plan names for the subscription response (planName).
const PLAN_NAMES = {
  'market-stall': 'Market Stall',
  'shophouse': 'Shophouse',
  'chain': 'Chain'
};

// Extends a tenant's plan inside the caller's transaction (mark-paid).
// plan_expires_at is `timestamp` (stored UTC wall time) while NOW() is
// timestamptz: without explicit AT TIME ZONE 'UTC' the implicit cast uses the
// session TimeZone — a session set to 'Asia/Phnom_Penh' stores local wall time
// (+7h off, calendar-day shift possible). Months are added to the naive UTC
// wall time, so "one calendar month later in UTC" is session-independent.
// LOWER keeps stored plan values canonical (legacy rows may hold 'SHOPHOUSE');
// a session with no plan keeps the tenant's current plan instead of writing a
// placeholder value.
const extendPlan = (client, plan, months, tenantId) =>
  client.query(
    `UPDATE tenants
        SET plan = COALESCE(LOWER(NULLIF($1, '')), plan),
            plan_expires_at = (GREATEST(plan_expires_at AT TIME ZONE 'UTC', NOW()) AT TIME ZONE 'UTC') + make_interval(months => $2)
      WHERE id = $3`,
    [plan, months, tenantId]
  );

// 1. GET Subscription info (read-only)
router.get('/subscription', authenticate, requireTenant, async (req, res) => {
  try {
    const tenantRes = await db.query(
      `SELECT plan, plan_expires_at FROM tenants WHERE id = $1`,
      [req.tenantId]
    );
    const tenant = tenantRes.rows[0] || { plan: null, plan_expires_at: null };
    const storedPlan = String(tenant.plan || 'free').toLowerCase();
    const expired =
      tenant.plan_expires_at && new Date(tenant.plan_expires_at).getTime() < Date.now();
    const effectivePlan = expired ? 'free' : storedPlan;
    res.json({
      success: true,
      // case-insensitive, NULL reads as free (live rows hold 'FREE', 'free', ...);
      // an expired paid plan behaves as free
      plan: effectivePlan,
      planName: PLAN_NAMES[effectivePlan] || effectivePlan,
      status: effectivePlan === 'free' ? 'inactive' : 'active',
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
    const normPlan = String(plan).toLowerCase();   // canonical plan values are lowercase
    const normCurr = String(currency).toUpperCase();
    const months = Number(period_months);

    if (
      !Number.isInteger(months) ||
      months <= 0 ||
      months >= 120 ||
      !PLANS[normPlan] ||
      !PLANS[normPlan][months] ||
      !PLANS[normPlan][months][normCurr]
    ) {
      return res.status(400).json({ error: 'Invalid plan, period, or currency combination' });
    }

    const expectedAmount = PLANS[normPlan][months][normCurr];
    const storedPlan = normPlan;
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
      `INSERT INTO khqr_sessions (tenant_id, user_id, plan, period_months, amount, currency, md5, qr_string, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING', $9)
       ON CONFLICT DO NOTHING`,
      [req.tenantId, req.user.userId, storedPlan, months, expectedAmount, normCurr, md5, qrString, expiresAt]
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


// 4. Super Admin Endpoints
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

router.post('/admin/sessions/:id/mark-paid', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: 'Reason is required for manual mark-paid' });
    }

    const sessionRes = await db.query(`SELECT * FROM khqr_sessions WHERE id = $1`, [id]);
    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const session = sessionRes.rows[0];
    const months = Number.isInteger(session.period_months) && session.period_months > 0
      ? session.period_months
      : 1;

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const manualHash = 'MANUAL-' + crypto.randomBytes(8).toString('hex');
      const updateRes = await client.query(
        `UPDATE khqr_sessions SET status = 'PAID', bakong_hash = $2, paid_at = NOW(), verified_by = $3, raw_response = $4 WHERE id = $1 AND status != 'PAID' RETURNING *`,
        [id, manualHash, `manual:${req.user.userId}`, JSON.stringify({ reason, marked_by: req.user.userId })]
      );

      if (updateRes.rowCount > 0) {
        await extendPlan(client, session.plan, months, session.tenant_id);
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

// Test hook: lets a test run the mark-paid UPDATE on a connection whose
// session TimeZone is not the pool default (precedent: tenants.js
// systemStatsHandler).
router.extendPlan = extendPlan;
module.exports = router;
