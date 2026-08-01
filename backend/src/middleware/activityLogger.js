// backend/src/middleware/activityLogger.js
const { pool } = require('../config/db');

const logActivity = async (req, res, next) => {
  // Store original send method
  const originalSend = res.send;
  
  // Only log for authenticated requests
  if (req.user) {
    const userId = req.user.userId || req.user.id;
    const method = req.method;
    const path = req.path;
    
    // Determine action type
    let actionPrefix = '';
    if (method === 'POST') actionPrefix = 'Created';
    else if (method === 'PUT') actionPrefix = 'Updated';
    else if (method === 'DELETE') actionPrefix = 'Deleted';
    else if (method === 'GET') actionPrefix = 'Viewed';
    
    // Extract table name from path
    const pathParts = path.split('/').filter(Boolean);
    let tableName = pathParts[0] || 'unknown';
    
    // Map to table names
    const tableMap = {
      'customers': 'tbl_customers',
      'products': 'tbl_products',
      'orders': 'tbl_orders',
      'users': 'tbl_users',
      'suppliers': 'tbl_suppliers',
      'stock': 'tbl_stock',
      'activity-logs': 'tbl_activity_logs'
    };
    tableName = tableMap[tableName] || tableName;
    
    // Override send to capture response
    res.send = function(data) {
      // Only log successful operations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const recordId = req.params.id || req.params.productid || null;
        const action = `${actionPrefix} ${tableName}`;
        const details = {
          method,
          path,
          query: req.query,
          body: method !== 'GET' ? req.body : undefined,
          status: res.statusCode,
          ip: req.ip,
          userAgent: req.headers['user-agent']
        };
        
        // Log asynchronously (don't wait for result)
        pool.query(
          `INSERT INTO tbl_activity_logs (user_id, action, table_name, record_id, details)
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, action, tableName, recordId, JSON.stringify(details)]
        ).catch(err => console.error('❌ Failed to log activity:', err));
      }
      
      // Call original send
      originalSend.call(this, data);
    };
  }
  
  next();
};

module.exports = { logActivity };