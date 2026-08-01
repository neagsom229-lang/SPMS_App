/**
 * Payment Controller
 * -------------------
 * Ties SPMS orders to ABA PayWay KHQR payments.
 *
 * NOTE: This assumes an `orders` table with at least:
 *   id, total_amount, currency, payment_status ('pending'|'paid'|'failed'|'expired'),
 *   payway_tran_id, created_at
 * Adjust the SQL to match your actual schema/ORM (this uses the `pg` pool
 * pattern common in Express+Neon setups — swap `db.query` for your own
 * db helper if different).
 */

const { createKHQRPayment, checkTransactionStatus } = require('../services/paywayService');
const db = require('../db'); // <- your existing pg pool / query helper

/**
 * POST /api/payments/khqr/create
 * body: { orderId }
 */
async function createPayment(req, res) {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ error: 'orderId is required' });
    }

    const orderResult = await db.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    const order = orderResult.rows[0];
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (order.payment_status === 'paid') {
      return res.status(409).json({ error: 'Order is already paid' });
    }

    // tran_id must be <=20 chars and unique per attempt — combine order id + short timestamp
    const tranId = `SPMS${order.id}${Date.now().toString().slice(-6)}`.slice(0, 20);

    const payment = await createKHQRPayment({
      tranId,
      amount: Number(order.total_amount),
      currency: order.currency || 'USD',
      customer: {
        firstname: req.user?.firstName,
        lastname: req.user?.lastName,
        email: req.user?.email,
        phone: req.user?.phone,
      },
      lifetimeMinutes: 5,
      callbackUrl: `${process.env.APP_BASE_URL}/api/payments/khqr/webhook`,
    });

    await db.query(
      `UPDATE orders SET payway_tran_id = $1, payment_status = 'pending' WHERE id = $2`,
      [payment.tranId, order.id]
    );

    return res.json({
      tranId: payment.tranId,
      qrImage: payment.qrImageDataUrl,
      abapayDeeplink: payment.abapayDeeplink,
      checkoutQrUrl: payment.checkoutQrUrl,
      expiresInSeconds: payment.expiresInSeconds,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[createPayment] failed:', err.paywayResponse || err.message);
    return res.status(502).json({ error: 'Failed to create KHQR payment', detail: err.message });
  }
}

/**
 * GET /api/payments/khqr/status/:tranId
 * Used by the frontend for polling (fallback if the webhook is delayed/misses).
 */
async function getPaymentStatus(req, res) {
  try {
    const { tranId } = req.params;
    const { status } = await checkTransactionStatus(tranId);

    if (status === 'APPROVED') {
      await db.query(
        `UPDATE orders SET payment_status = 'paid' WHERE payway_tran_id = $1 AND payment_status != 'paid'`,
        [tranId]
      );
    } else if (status === 'DECLINED' || status === 'CANCELLED') {
      await db.query(
        `UPDATE orders SET payment_status = 'failed' WHERE payway_tran_id = $1`,
        [tranId]
      );
    }

    return res.json({ status });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[getPaymentStatus] failed:', err.message);
    return res.status(502).json({ error: 'Failed to check payment status' });
  }
}

/**
 * POST /api/payments/khqr/webhook
 * ABA PayWay posts here when a KHQR payment is approved.
 *
 * IMPORTANT: ABA's webhook payload is NOT signed/HMAC'd (unlike the
 * request-side hash). Never trust it blindly — re-verify the transaction
 * with the Check Transaction API before marking an order as paid. This
 * prevents anyone who discovers your webhook URL from POSTing a fake
 * "APPROVED" body to mark orders as paid for free.
 */
async function handleWebhook(req, res) {
  try {
    const { merchant_ref, transaction_id } = req.body;
    const tranId = merchant_ref || transaction_id;

    if (!tranId) {
      return res.status(400).json({ error: 'Missing transaction reference' });
    }

    // Re-verify server-side instead of trusting req.body.payment_status directly.
    const { status } = await checkTransactionStatus(tranId);

    if (status === 'APPROVED') {
      await db.query(
        `UPDATE orders SET payment_status = 'paid' WHERE payway_tran_id = $1`,
        [tranId]
      );
      // TODO: trigger order fulfillment / subscription activation here
    }

    // Always 200 so PayWay doesn't retry unnecessarily once we've processed it.
    return res.sendStatus(200);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[handleWebhook] failed:', err.message);
    return res.sendStatus(500); // let PayWay retry
  }
}

module.exports = {
  createPayment,
  getPaymentStatus,
  handleWebhook,
};