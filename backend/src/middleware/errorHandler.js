// backend/src/middleware/errorHandler.js
const crypto = require('crypto');

const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  const isProd = process.env.NODE_ENV === 'production';
  const errorId = crypto.randomUUID();

  console.error(`❌ [Error ID: ${errorId}] ${status} - ${err.message}`, err.stack);

  if (status >= 500 && isProd) {
    return res.status(500).json({
      error: 'Internal Server Error',
      errorId: errorId
    });
  }

  res.status(status).json({
    error: err.message || 'Internal Server Error',
    errorId: isProd ? errorId : undefined
  });
};

module.exports = errorHandler;
