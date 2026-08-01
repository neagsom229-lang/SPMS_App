// backend/src/middleware/cache.js
const cache = require('memory-cache');

const cacheMiddleware = (duration) => {
  return (req, res, next) => {
    const key = `__express__${req.originalUrl || req.url}`;
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

module.exports = { cacheMiddleware };