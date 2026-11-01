// backend/src/services/bakongReconciler.js
const pool = require('../config/postgres');
const { verifyTransaction } = require('./bakongVerifier');

const ADVISORY_LOCK_ID = 849203184;

async function runReconciliationBatch() {
  if (process.env.NODE_ENV === 'test') return;

  const client = await pool.connect();
  try {
    // Attempt advisory lock for single-runner execution across instances
    const lockRes = await client.query('SELECT pg_try_advisory_lock($1) as acquired', [ADVISORY_LOCK_ID]);
    if (!lockRes.rows[0]?.acquired) {
      client.release();
      return;
    }

    try {
      // Find PENDING or EXPIRED sessions younger than 24 hours, batch up to 50
      const sessionsRes = await client.query(
        `SELECT * FROM khqr_sessions 
         WHERE status IN ('PENDING', 'EXPIRED') 
           AND created_at >= NOW() - INTERVAL '24 hours' 
         ORDER BY created_at ASC 
         LIMIT 50`
      );

      const sessions = sessionsRes.rows;
      if (sessions.length === 0) {
        return;
      }

      for (const session of sessions) {
        try {
          const verification = await verifyTransaction(session, session.md5);
          const now = new Date();
          const expiresAt = new Date(session.expires_at);
          const isLate = now > expiresAt;

          if (verification.state === 'PAID') {
            // Check if bakong_hash already used in another session
            const existingHashRes = await client.query(
              `SELECT id FROM khqr_sessions WHERE bakong_hash = $1 AND id <> $2`,
              [verification.hash, session.id]
            );
            if (existingHashRes.rows.length > 0) {
              console.error(`🚨 [Reconciler] Replay attack blocked: Bakong hash ${verification.hash} already used!`);
              continue;
            }

            const finalStatus = isLate ? 'PAID_LATE' : 'PAID';

            const updateRes = await client.query(
              `UPDATE khqr_sessions 
               SET status = $1, bakong_hash = $2, paid_at = NOW(), verified_by = 'bakong', raw_response = $3 
               WHERE md5 = $4 AND status IN ('PENDING', 'EXPIRED') 
               RETURNING *`,
              [finalStatus, verification.hash, JSON.stringify(verification.raw), session.md5]
            );

            if (updateRes.rows.length > 0) {
              const months = session.period_months || 1;
              await client.query(
                `UPDATE tenants 
                 SET plan = $1, 
                     plan_expires_at = GREATEST(COALESCE(plan_expires_at, NOW()), NOW()) + INTERVAL '1 month' * $2 
                 WHERE id = $3`,
                [session.plan || 'Standard', months, session.tenant_id]
              );

              await client.query(
                `INSERT INTO tbl_activity_logs (user_id, action, target_table, target_id, tenant_id)
                 VALUES ($1, $2, 'khqr_sessions', $3, $4)`,
                [session.user_id, `Reconciler verified payment (${finalStatus}) for plan ${session.plan}`, session.id, session.tenant_id]
              );
              console.log(`✅ [Reconciler] Session ${session.md5} marked as ${finalStatus} and tenant subscription extended.`);
            }
          } else if (verification.state === 'NOT_FOUND') {
            if (isLate && session.status === 'PENDING') {
              await client.query(`UPDATE khqr_sessions SET status = 'EXPIRED' WHERE id = $1`, [session.id]);
            }
          }
        } catch (itemErr) {
          console.error(`❌ [Reconciler error for session ${session.md5}]:`, itemErr.message);
        }
      }
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_ID]);
      client.release();
    }
  } catch (err) {
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
