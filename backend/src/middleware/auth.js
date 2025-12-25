const jwt = require("jsonwebtoken");

function getBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== "string") return null;

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const token = match[1].trim();
  return token.length ? token : null;
}

function authMiddleware(req, res, next) {
  const token = getBearerToken(req);

  if (!token) {
    return res.status(401).json({ message: "Missing or invalid Authorization header" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Only allow access tokens here
    if (!payload || payload.type !== "access") {
      return res.status(401).json({ message: "Invalid token" });
    }

    req.user = payload; // { id, email, roleId, roleName, type:'access' }
    return next();
  } catch (err) {
    if (err && err.name === "TokenExpiredError") {
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

    // Only accept access tokens for optional auth as well
    if (!payload || payload.type !== "access") {
      req.user = null;
      return next();
    }

    req.user = payload;
    return next();
  } catch {
    req.user = null;
    return next();
  }
}

// 🔒 STRICT single-role guard
function requireRole(roleName) {
  return function roleGuard(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const actual = req.user.roleName || null;
    if (!actual) {
      return res.status(403).json({ message: "Role not recognized" });
    }

    if (actual !== roleName) {
      return res.status(403).json({ message: "Access denied" });
    }

    return next();
  };
}

// 🔒 Explicit multi-role guard
function requireAnyRole(roleNames) {
  const allowed = new Set(roleNames);

  return function anyRoleGuard(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const actual = req.user.roleName || null;
    if (!actual) {
      return res.status(403).json({ message: "Role not recognized" });
    }

    if (!allowed.has(actual)) {
      return res.status(403).json({ message: "Access denied" });
    }

    return next();
  };
}

const requireAdmin = requireRole("product_manager");
const requireSalesManager = requireRole("sales_manager");
const requireProductManager = requireRole("product_manager");
const requireProductManagerOrAdmin = requireAnyRole(["product_manager", "admin"]);

module.exports = {
  authMiddleware,
  optionalAuthMiddleware,

  requireAdmin,
  requireSalesManager,
  requireProductManager,
  requireProductManagerOrAdmin,
};
