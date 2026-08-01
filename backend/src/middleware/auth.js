// backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  // ✅ Get token from Authorization header
  const authHeader = req.headers.authorization;
  console.log('🔑 Auth Header:', authHeader);
  
  if (!authHeader) {
    console.log('❌ No Authorization header found');
    return res.status(401).json({ error: 'Authentication required' });
  }

  // ✅ Check if it starts with Bearer
  if (!authHeader.startsWith('Bearer ')) {
    console.log('❌ Invalid Authorization format - must start with Bearer');
    return res.status(401).json({ error: 'Invalid authorization format' });
  }

  // ✅ Extract token
  const token = authHeader.split(' ')[1];
  console.log('🔑 Token extracted:', token ? token.substring(0, 30) + '...' : 'null');

  if (!token) {
    console.log('❌ No token found in Authorization header');
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    // ✅ Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    console.log('✅ Token verified:', decoded);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('❌ Token verification failed:', error.message);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

module.exports = { authenticate, authorize };