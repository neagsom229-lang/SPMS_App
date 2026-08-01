/**
 * ABA PayWay Service
 * -------------------
 * Wraps ABA PayWay's raw REST API (there is no official Node SDK / npm
 * package from ABA — @abapayway/node does not exist — so we call the
 * HTTP API directly).
 *
 * Docs referenced (ABA PayWay official API reference):
 *  - Purchase API:          POST /api/payment-gateway/v1/payments/purchase
 *  - Check Transaction API: POST /api/payment-gateway/v1/payments/check-transaction-2
 *  - KHQR webhook payload:  see handlePaywayWebhook() in paymentController.js
 *
 * Env vars required (see backend/.env.example):
 *  PAYWAY_MERCHANT_ID, PAYWAY_API_KEY, PAYWAY_BASE_URL
 */

const axios = require('axios');
const crypto = require('crypto');

const MERCHANT_ID = process.env.PAYWAY_MERCHANT_ID;
const API_KEY = process.env.PAYWAY_API_KEY; // ABA calls this the "public_key" in their hash docs
const BASE_URL = process.env.PAYWAY_BASE_URL || 'https://checkout-sandbox.payway.com.kh';

if (!MERCHANT_ID || !API_KEY) {
  // Fail loudly at boot rather than silently sending bad requests to ABA.
  // eslint-disable-next-line no-console
  console.warn('[paywayService] PAYWAY_MERCHANT_ID / PAYWAY_API_KEY are not set. KHQR payments will fail.');
}

/** YYYYMMDDHHmmss in UTC, as required by PayWay */
function reqTime() {
  return new Date()
    .toISOString()
    .replace(/[-:T]/g, '')
    .slice(0, 14);
}

/** Base64(HMAC-SHA512(concatenatedFields, API_KEY)) */
function signHash(concatenatedFields) {
  return crypto
    .createHmac('sha512', API_KEY)
    .update(concatenatedFields, 'utf8')
    .digest('base64');
}

/**
 * Create a dynamic KHQR payment via the Purchase API.
 *
 * @param {Object} params
 * @param {string} params.tranId       Unique transaction id (<=20 chars). Use your order id.
 * @param {number} params.amount       Purchase amount (e.g. 12.50)
 * @param {string} [params.currency]   'USD' or 'KHR'. KHR must not have decimals.
 * @param {Array}  [params.items]      [{ name, quantity, price }]
 * @param {Object} [params.customer]   { firstname, lastname, email, phone }
 * @param {number} [params.lifetimeMinutes] QR validity window. Min 3, default 5.
 * @param {string} [params.callbackUrl]     Your webhook URL (also configurable in PayWay portal).
 *
 * @returns {Promise<{tranId: string, qrString: string, qrImageDataUrl: string, abapayDeeplink: string, checkoutQrUrl: string}>}
 */
async function createKHQRPayment({
  tranId,
  amount,
  currency = 'USD',
  items = [],
  customer = {},
  lifetimeMinutes = 5,
  callbackUrl = process.env.PAYWAY_WEBHOOK_URL || '',
}) {
  const req_time = reqTime();
  const merchant_id = MERCHANT_ID;
  const tran_id = tranId;
  const amountStr = currency === 'KHR' ? String(Math.round(amount)) : amount.toFixed(2);
  const itemsB64 = items.length
    ? Buffer.from(JSON.stringify(items)).toString('base64')
    : '';
  const shipping = ''; // not used here; keep as empty string to match hash order
  const firstname = customer.firstname || '';
  const lastname = customer.lastname || '';
  const email = customer.email || '';
  const phone = customer.phone || '';
  const type = 'purchase';
  const payment_option = 'abapay_khqr_deeplink'; // returns qr_string + deeplink as JSON (no page redirect)
  const return_url = callbackUrl ? Buffer.from(callbackUrl).toString('base64') : '';
  const cancel_url = '';
  const continue_success_url = '';
  const return_deeplink = '';
  const custom_fields = '';
  const return_params = '';
  const payout = '';
  const lifetime = String(lifetimeMinutes);
  const additional_params = '';
  const google_pay_token = '';
  const skip_success_page = '';

  // Exact concatenation order required by ABA's hash spec for the Purchase API.
  const toHash =
    req_time +
    merchant_id +
    tran_id +
    amountStr +
    itemsB64 +
    shipping +
    firstname +
    lastname +
    email +
    phone +
    type +
    payment_option +
    return_url +
    cancel_url +
    continue_success_url +
    return_deeplink +
    currency +
    custom_fields +
    return_params +
    payout +
    lifetime +
    additional_params +
    google_pay_token +
    skip_success_page;

  const hash = signHash(toHash);

  const form = new URLSearchParams();
  form.append('req_time', req_time);
  form.append('merchant_id', merchant_id);
  form.append('tran_id', tran_id);
  form.append('amount', amountStr);
  if (itemsB64) form.append('items', itemsB64);
  if (firstname) form.append('firstname', firstname);
  if (lastname) form.append('lastname', lastname);
  if (email) form.append('email', email);
  if (phone) form.append('phone', phone);
  form.append('type', type);
  form.append('payment_option', payment_option);
  if (return_url) form.append('return_url', return_url);
  form.append('currency', currency);
  form.append('lifetime', lifetime);
  form.append('hash', hash);

  const { data } = await axios.post(
    `${BASE_URL}/api/payment-gateway/v1/payments/purchase`,
    form,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  if (!data || data.status?.code !== '00') {
    const err = new Error(data?.status?.message || 'PayWay purchase request failed');
    err.paywayResponse = data;
    throw err;
  }

  // ABA returns qr_string (the raw KHQR payload) but not a ready-made image
  // for this payment_option, so we render it ourselves with the `qrcode` lib.
  const QRCode = require('qrcode');
  const qrImageDataUrl = await QRCode.toDataURL(data.qr_string, { width: 400, margin: 1 });

  return {
    tranId: data.status.tran_id,
    qrString: data.qr_string,
    qrImageDataUrl,
    abapayDeeplink: data.abapay_deeplink,
    checkoutQrUrl: data.checkout_qr_url,
    expiresInSeconds: lifetimeMinutes * 60,
  };
}

/**
 * Poll transaction status (works for transactions created within the last 7 days).
 * @param {string} tranId
 * @returns {Promise<{status: 'APPROVED'|'PENDING'|'DECLINED'|'REFUNDED'|'CANCELLED', raw: object}>}
 */
async function checkTransactionStatus(tranId) {
  const req_time = reqTime();
  const merchant_id = MERCHANT_ID;
  const tran_id = tranId;

  const hash = signHash(req_time + merchant_id + tran_id);

  const { data } = await axios.post(
    `${BASE_URL}/api/payment-gateway/v1/payments/check-transaction-2`,
    { req_time, merchant_id, tran_id, hash },
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (data.status?.code !== '00') {
    // code 6 = tran_id not found (e.g. QR never scanned), not necessarily an error
    return { status: 'PENDING', raw: data };
  }

  return { status: data.data.payment_status, raw: data };
}

module.exports = {
  createKHQRPayment,
  checkTransactionStatus,
};