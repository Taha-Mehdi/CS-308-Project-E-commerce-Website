const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res
        .status(401)
        .json({ message: 'Missing or invalid Authorization header' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // payload: { id, email, roleId, type: 'access' }
    req.user = payload;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      // less noisy log
      console.warn(
          'JWT expired for request:',
          req.method,
          req.originalUrl,
          'expiredAt:',
          err.expiredAt
      );
      return res.status(401).json({ message: 'Token expired' });
    }

    console.error('JWT verification failed:', err);
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// NEW: Checks for token, but allows guests to pass through (req.user will be null)
function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  // If no header or bad format, treat as guest (no error)
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // Logged in user found
    next();
  } catch (err) {
    // If token is expired or invalid, just treat them as guest
    req.user = null;
    next();
  }
}

// Very simple admin check: assumes roleId === 1 is admin
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  if (req.user.roleId !== 1) {
    return res.status(403).json({ message: 'Admin access required' });
  }

  next();
}

module.exports = {
  authMiddleware,
  optionalAuthMiddleware, // <--- Exporting the new function
  requireAdmin,
};