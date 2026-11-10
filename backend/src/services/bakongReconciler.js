// backend/src/services/bakongReconciler.js
const pool = require('../config/postgres');
const { verifyTransaction } = require('./bakongVerifier');

const ADVISORY_LOCK_ID = 849203184;

async function runReconciliationBatch() {
  if (process.env.NODE_ENV === 'test') return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const lockRes = await client.query('SELECT pg_try_advisory_xact_lock($1) as acquired', [ADVISORY_LOCK_ID]);
    if (!lockRes.rows[0]?.acquired) {
      await client.query('ROLLBACK');
      client.release();
      return;
    }

    const now = new Date();
    const sessionsRes = await client.query(
      `SELECT * FROM khqr_sessions
       WHERE status = 'PENDING' AND created_at >= NOW() - INTERVAL '24 hours'
       ORDER BY created_at ASC
       LIMIT 50`
    );

    const sessions = sessionsRes.rows;
    for (const session of sessions) {
      try {
        const verifyResult = await verifyTransaction(session, session.md5);
        if (verifyResult.state === 'PAID') {
          const updateRes = await client.query(
            `UPDATE khqr_sessions
             SET status = 'PAID', bakong_hash = $2, paid_at = NOW(), verified_by = 'reconciler', raw_response = $3
             WHERE md5 = $1 AND status = 'PENDING'
             RETURNING *`,
            [session.md5, verifyResult.hash, JSON.stringify(verifyResult.raw || {})]
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
              [session.tenant_id, session.user_id, 'SUBSCRIPTION_RECONCILED_PAID', JSON.stringify({ plan: session.plan, hash: verifyResult.hash })]
            );
          }
        } else {
          if (session.expires_at && new Date(session.expires_at) < now) {
            if (verifyResult.state === 'PAID') {
              await client.query(
                `UPDATE khqr_sessions SET status = 'PAID_LATE', bakong_hash = $2, paid_at = NOW(), verified_by = 'reconciler_late', raw_response = $3 WHERE md5 = $1 AND status = 'PENDING'`,
                [session.md5, verifyResult.hash, JSON.stringify(verifyResult.raw || {})]
              );
            } else {
              await client.query(`UPDATE khqr_sessions SET status = 'EXPIRED' WHERE id = $1 AND status = 'PENDING'`, [session.id]);
            }
          }
        }
      } catch (innerErr) {
        console.error(`❌ [Reconciler error for md5 ${session.md5}]:`, innerErr.message);
      }
    }

    await client.query('COMMIT');
    client.release();
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (e) {}
    client.release();
    console.error('❌ [Reconciler batch error]:', err.message);
  }
}

function startReconciler() {
  if (process.env.NODE_ENV === 'test') return;
  const interval = setInterval(runReconciliationBatch, 30000);
  interval.unref();
  console.log('🔄 Background Bakong payment reconciler started (30s interval)');
}

module.exports = {
  startReconciler,
  runReconciliationBatch
};
