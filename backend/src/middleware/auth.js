const jwt = require("jsonwebtoken");
const { db } = require("../db");
const { roles } = require("../db/schema");
const { eq } = require("drizzle-orm");

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

    // IMPORTANT: only allow access tokens here
    if (!payload || payload.type !== "access") {
      return res.status(401).json({ message: "Invalid token" });
    }

    req.user = payload; // { id, email, roleId, roleName?, type:'access' }
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

// Role lookup with small in-memory cache
const roleCache = new Map(); // roleId -> { name, expiresAtMs }
const ROLE_CACHE_TTL_MS = 5 * 60 * 1000;

async function getRoleNameById(roleId) {
  const rid = Number(roleId);
  if (!Number.isInteger(rid)) return null;

  const cached = roleCache.get(rid);
  const now = Date.now();
  if (cached && cached.expiresAtMs > now) return cached.name;

  const rows = await db.select().from(roles).where(eq(roles.id, rid));
  const name = rows.length ? rows[0].name : null;

  roleCache.set(rid, { name, expiresAtMs: now + ROLE_CACHE_TTL_MS });
  return name;
}

function requireRoleNames(allowedRoleNames) {
  const allowed = new Set(allowedRoleNames);

  return async function roleGuard(req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Prefer roleName from JWT if present, else fetch by roleId
      let roleName = req.user.roleName;
      if (!roleName) {
        const roleId = Number(req.user.roleId);
        roleName = await getRoleNameById(roleId);
      }

      if (!roleName) {
        return res.status(403).json({ message: "Role not recognized" });
      }

      if (!allowed.has(roleName)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // attach for downstream usage
      req.user.roleName = roleName;

      return next();
    } catch (err) {
      console.error("Role guard error:", err);
      return res.status(500).json({ message: "Authorization check failed" });
    }
  };
}

const requireAdmin = requireRoleNames(["admin"]);
const requireSalesManagerOrAdmin = requireRoleNames(["admin", "sales_manager"]);
const requireProductManagerOrAdmin = requireRoleNames(["admin", "product_manager"]);

module.exports = {
  authMiddleware,
  optionalAuthMiddleware,
  requireAdmin,
  requireSalesManagerOrAdmin,
  requireProductManagerOrAdmin,
};
