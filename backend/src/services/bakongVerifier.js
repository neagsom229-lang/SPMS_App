// backend/src/services/bakongVerifier.js
const axios = require('axios');

const expectedAccount = process.env.BAKONG_ACCOUNT_ID;
if (!expectedAccount) {
  throw new Error('BAKONG_ACCOUNT_ID environment variable is required');
}

const inFlightRequests = new Map(); // md5 -> { promise, timestamp }
const THROTTLE_MS = 3000;

function maskAccountId(acc) {
  if (!acc || acc.length < 6) return '***';
  return acc.slice(0, 3) + '***' + acc.slice(-3);
}

function checkTokenExpiry() {
  const expiresAtStr = process.env.BAKONG_TOKEN_EXPIRES_AT;
  if (!expiresAtStr) return;
  const expiresAt = new Date(expiresAtStr).getTime();
  if (isNaN(expiresAt)) return;
  const daysLeft = (expiresAt - Date.now()) / (1000 * 60 * 60 * 24);
  if (daysLeft < 14) {
    console.warn(`⚠️ WARNING: Bakong token expires in ${Math.ceil(daysLeft)} days (${expiresAtStr}). Please renew.`);
  }
}

checkTokenExpiry();
setInterval(checkTokenExpiry, 24 * 60 * 60 * 1000).unref();

async function verifyTransaction(session, providedMd5) {
  const provider = (process.env.BAKONG_PROVIDER || 'nbc').toLowerCase();
  const apiBase = process.env.BAKONG_API_BASE || 'https://api-bakong.nbc.gov.kh';
  const token = process.env.BAKONG_TOKEN || process.env.KHQR_RBK_TOKEN;

  if (provider === 'manual') {
    return { state: 'NOT_FOUND', errorKind: null };
  }

  // Per-md5 throttle: max 1 upstream call per md5 per 3 s (share in-flight promise, disabled in test env)
  if (process.env.NODE_ENV !== 'test') {
    const now = Date.now();
    const cached = inFlightRequests.get(providedMd5);
    if (cached && (now - cached.timestamp < THROTTLE_MS)) {
      return cached.promise;
    }
  }

  const promise = (async () => {
    let attempt = 0;
    const maxAttempts = 2; // initial + 1 retry on network error only

    while (attempt < maxAttempts) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        let url = `${apiBase}/v1/check_transaction_by_md5`;
        let headers = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        };
        let body = { md5: providedMd5 };

        if (provider === 'relay') {
          url = process.env.BAKONG_RELAY_URL || url;
          if (process.env.BAKONG_RELAY_HEADERS) {
            try {
              const extraHeaders = JSON.parse(process.env.BAKONG_RELAY_HEADERS);
              headers = { ...headers, ...extraHeaders };
            } catch (e) {
              // ignore json parse error
            }
          }
        }

        const res = await axios.post(url, body, {
          headers,
          signal: controller.signal,
          validateStatus: () => true
        });
        clearTimeout(timeoutId);

        const status = res.status;
        const data = res.data;

        // 401/403 => ERROR with loud error log (status + masked body)
        if (status === 401 || status === 403) {
          const sanitizedBody = typeof data === 'object' ? { ...data } : { raw: String(data) };
          if (sanitizedBody.token) sanitizedBody.token = '***';
          if (sanitizedBody.secret) sanitizedBody.secret = '***';
          console.error(`🚨 BAKONG AUTH ERROR [${status}]: Account ${maskAccountId(expectedAccount)} - Body:`, JSON.stringify(sanitizedBody));
          return { state: 'ERROR', errorKind: status === 401 ? 'AUTH' : 'FORBIDDEN_OR_GEO', raw: data };
        }

        if (status === 429) {
          return { state: 'ERROR', errorKind: 'RATE', raw: data };
        }

        if (status >= 500) {
          return { state: 'ERROR', errorKind: 'UPSTREAM', raw: data };
        }

        if (status !== 200) {
          return { state: 'ERROR', errorKind: 'UPSTREAM', raw: data };
        }

        // PAID only if HTTP 200 AND responseCode === 0 AND data.hash present
        if (data && data.responseCode === 0 && data.data) {
          const tx = data.data;
          const hash = tx.hash || tx.tranId || tx.id;
          if (!hash) {
            return { state: 'NOT_FOUND', raw: data };
          }

          const amount = Number(tx.amount);
          const currency = tx.currency ? tx.currency.toUpperCase() : '';
          const toAccountId = tx.toAccountId;
          const createdDateMs = tx.createdDate ? new Date(tx.createdDate).getTime() : 0;

          const sessionAmount = Number(session.amount || session.expected_amount);
          const sessionCurrency = session.currency ? session.currency.toUpperCase() : '';

          const isValidCurrency = currency && currency.length > 0;
          const isValidAccount = toAccountId && typeof toAccountId === 'string' && toAccountId.length > 0;
          const isValidTimestamp = createdDateMs && !isNaN(createdDateMs) && createdDateMs > 0;

          if (!isValidCurrency || !isValidAccount || !isValidTimestamp) {
            console.error(`🚨 BAKONG MISMATCH ALERT: md5=${providedMd5}, invalid currency/account/timestamp, currency=${currency}, toAccountId=${toAccountId}, createdDateMs=${createdDateMs}`);
            return { state: 'FAILED_MISMATCH', hash, amount, currency, toAccountId, createdDateMs, raw: data };
          }

          const amountsMatch = currency === 'KHR' 
            ? Math.round(amount) === Math.round(sessionAmount)
            : Math.abs(amount - sessionAmount) < 0.005;

          const currenciesMatch = currency === sessionCurrency;
          const accountsMatch = toAccountId.toLowerCase().trim() === expectedAccount.toLowerCase().trim();

          const sessionCreatedMs = session.created_at ? new Date(session.created_at).getTime() - (2 * 60 * 1000) : Date.now() - 3600000;
          const sessionExpiryMs = session.expires_at ? new Date(session.expires_at).getTime() + 300000 : Date.now() + 3600000;
          const timeMatch = createdDateMs >= sessionCreatedMs && createdDateMs <= sessionExpiryMs;

          if (!amountsMatch || !currenciesMatch || !accountsMatch || !timeMatch) {
            console.error(`🚨 BAKONG MISMATCH ALERT: md5=${providedMd5}, expectedAmt=${sessionAmount}, gotAmt=${amount}, expectedCurr=${sessionCurrency}, gotCurr=${currency}, expectedAcc=${maskAccountId(expectedAccount)}, gotAcc=${maskAccountId(toAccountId)}, timeMatch=${timeMatch}`);
            return { state: 'FAILED_MISMATCH', hash, amount, currency, toAccountId, createdDateMs, raw: data };
          }

          return {
            state: 'PAID',
            hash,
            amount,
            currency,
            toAccountId,
            createdDateMs,
            raw: data
          };
        }

        // responseCode 1 or message indicating not found => NOT_FOUND
        if (data && (data.responseCode === 1 || (data.responseMessage && data.responseMessage.toLowerCase().includes('not found')))) {
          return { state: 'NOT_FOUND', raw: data };
        }

        return { state: 'NOT_FOUND', raw: data };

      } catch (err) {
        clearTimeout(timeoutId);
        const isTimeout = err.name === 'AbortError' || err.code === 'ECONNABORTED';
        const isNetwork = isTimeout || err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' || err.code === 'EAI_AGAIN';

        if (isNetwork && attempt < maxAttempts) {
          continue; // retry once on network error only; never retry 4xx
        }

        return {
          state: 'ERROR',
          errorKind: isTimeout ? 'UPSTREAM' : 'NETWORK',
          message: err.message
        };
      }
    }
  })();

  if (process.env.NODE_ENV !== 'test') {
    inFlightRequests.set(providedMd5, { promise, timestamp: Date.now() });
  }
  return promise;
}

module.exports = {
  verifyTransaction
};
