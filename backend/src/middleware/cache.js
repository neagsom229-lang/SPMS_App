// backend/src/middleware/cache.js
const cache = require('memory-cache');

const cacheMiddleware = (duration) => {
  return (req, res, next) => {
    const tenantKey = req.user ? `${req.user.tenantId || 'super'}_${req.user.isSuperAdmin ? 'admin' : 'tenant'}` : 'public';
    const key = `__express__${tenantKey}_${req.originalUrl || req.url}`;
    const cachedBody = cache.get(key);

    if (cachedBody) {
      return res.json(cachedBody);
    }

    const originalSend = res.json;
    res.json = function(body) {
      cache.put(key, body, duration * 1000);
      originalSend.call(this, body);
    };

    next();
  };
};

const clearTenantCache = (tenantId) => {
  const keys = cache.keys();
  keys.forEach(k => {
    if (k.includes(`__express__${tenantId}_`) || k.includes(`__express__super_`)) {
      cache.del(k);
    }
  });
};

module.exports = { cacheMiddleware, clearTenantCache };
