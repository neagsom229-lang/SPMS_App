// backend/src/middleware/activityLogger.js
const pool = require('../config/postgres');

const logActivity = async (userId, action, targetTable, targetId, tenantId) => {
  try {
    await pool.query(
      `INSERT INTO tbl_activity_logs (user_id, action, target_table, target_id, tenant_id, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [userId || 1, action, targetTable, targetId || null, tenantId || null]
    );
  } catch (err) {
    console.error('❌ Failed to log activity to database:', err.message);
  }
};

const activityLoggerMiddleware = (action, targetTable) => {
  return async (req, res, next) => {
    const originalJson = res.json;
    res.json = function(data) {
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        const userId = req.user.userId;
        const tenantId = req.user.tenantId;
        const targetId = req.params.id || data?.id || data?.insertedId || null;
        logActivity(userId, action, targetTable, targetId, tenantId);
      }
      return originalJson.call(this, data);
    };
    next();
  };
};

module.exports = { logActivity, activityLoggerMiddleware };
