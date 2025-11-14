const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Missing or invalid Authorization header' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, email, roleId }
    next();
  } catch (err) {
    console.error('JWT verification failed:', err);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

module.exports = {
  authMiddleware,
};
