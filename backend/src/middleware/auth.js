const jwt = require("jsonwebtoken");
const { db } = require("../db");
const { roles } = require("../db/schema");
const { eq } = require("drizzle-orm");

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

// Role lookup with a small in-memory cache (performance + safety)
// 
const roleCache = new Map(); // roleId -> { name, expiresAtMs }
const ROLE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getRoleNameById(roleId) {
  if (!Number.isInteger(roleId)) return null;

  const cached = roleCache.get(roleId);
  const now = Date.now();

  if (cached && cached.expiresAtMs > now) {
    return cached.name;
  }

  const rows = await db.select().from(roles).where(eq(roles.id, roleId));
  const name = rows.length ? rows[0].name : null;

  roleCache.set(roleId, { name, expiresAtMs: now + ROLE_CACHE_TTL_MS });
  return name;
}

function requireRoleNames(allowedRoleNames) {
  const allowed = new Set(allowedRoleNames);

  return async function roleGuard(req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const roleId = Number(req.user.roleId);
      const roleName = await getRoleNameById(roleId);

      if (!roleName) {
        return res.status(403).json({ message: "Role not recognized" });
      }

      if (!allowed.has(roleName)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Attach roleName for downstream handlers if useful
      req.user.roleName = roleName;

      return next();
    } catch (err) {
      console.error("Role guard error:", err);
      return res.status(500).json({ message: "Authorization check failed" });
    }
  };
}

// Updated: no longer assumes roleId === 1
const requireAdmin = requireRoleNames(["admin"]);

// New: sales manager OR admin (for discounts, invoices, analytics)
const requireSalesManagerOrAdmin = requireRoleNames(["admin", "sales_manager"]);

// New: product manager OR admin (for cost field control, etc.)
const requireProductManagerOrAdmin = requireRoleNames([
  "admin",
  "product_manager",
]);

module.exports = {
  authMiddleware,
  optionalAuthMiddleware,
  requireAdmin,
  requireSalesManagerOrAdmin,
  requireProductManagerOrAdmin,
};
