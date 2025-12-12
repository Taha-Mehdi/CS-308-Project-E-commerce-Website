const jwt = require("jsonwebtoken");

function getBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== "string") return null;

  // Accept: "Bearer <token>" with any extra whitespace
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const token = match[1].trim();
  return token.length ? token : null;
}

function authMiddleware(req, res, next) {
  const token = getBearerToken(req);

  if (!token) {
    return res
      .status(401)
      .json({ message: "Missing or invalid Authorization header" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // payload: { id, email, roleId, type: 'access' }
    req.user = payload;
    return next();
  } catch (err) {
    if (err && err.name === "TokenExpiredError") {
      console.warn(
        "JWT expired for request:",
        req.method,
        req.originalUrl,
        "expiredAt:",
        err.expiredAt
      );
      return res.status(401).json({ message: "Token expired" });
    }

    console.error("JWT verification failed:", err);
    return res.status(401).json({ message: "Invalid token" });
  }
}

// Checks for token, but allows guests to pass through (req.user will be null)
function optionalAuthMiddleware(req, res, next) {
  const token = getBearerToken(req);

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    return next();
  } catch (err) {
    // Treat invalid/expired token as guest
    req.user = null;
    return next();
  }
}

// Very simple admin check: assumes roleId === 1 is admin
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  if (req.user.roleId !== 1) {
    return res.status(403).json({ message: "Admin access required" });
  }

  return next();
}

module.exports = {
  authMiddleware,
  optionalAuthMiddleware,
  requireAdmin,
};
