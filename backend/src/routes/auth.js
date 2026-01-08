const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const { db } = require("../db");
const { users, roles } = require("../db/schema");
const { eq } = require("drizzle-orm");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(1),
  taxId: z.string().min(1),
  address: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// ─────────────────────────────────────────────
// Helper: get roleName for a user row
// ─────────────────────────────────────────────
async function getRoleNameById(roleId) {
  const rid = Number(roleId);
  if (!Number.isInteger(rid)) return null;
  const roleRows = await db.select().from(roles).where(eq(roles.id, rid));
  return roleRows.length ? roleRows[0].name : null;
}

// ─────────────────────────────────────────────
// Helper: create access & refresh tokens
// ─────────────────────────────────────────────
function createAccessToken(user, roleName) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      roleId: user.roleId,
      roleName: roleName || null,
      type: "access",
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
}

function createRefreshToken(user, roleName) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      roleId: user.roleId,
      roleName: roleName || null,
      type: "refresh",
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// normalize user object for response
function publicUser(user, roleName) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    taxId: user.taxId,
    address: user.address,
    roleId: user.roleId,
    roleName: roleName || null,

    // ✅ IMPORTANT: expose balance to frontend
    accountBalance: Number(user.accountBalance || 0).toFixed(2),
  };
}

// ─────────────────────────────────────────────
// POST /auth/register
// ─────────────────────────────────────────────
router.post("/register", async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      console.error("Register validation error:", parsed.error.flatten());
      return res.status(400).json({
        message: "Invalid data",
        errors: parsed.error.flatten(),
      });
    }

    const { email, password, fullName, taxId, address } = parsed.data;

    const existing = await db.select().from(users).where(eq(users.email, email));
    if (existing.length > 0) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const roleRows = await db.select().from(roles).where(eq(roles.name, "customer"));
    if (roleRows.length === 0) {
      return res.status(500).json({ message: "Default role not configured" });
    }
    const customerRole = roleRows[0];

    const passwordHash = await bcrypt.hash(password, 10);

    const inserted = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        fullName,
        taxId,
        address,
        roleId: customerRole.id,
      })
      .returning();

    const user = inserted[0];
    const roleName = await getRoleNameById(user.roleId);

    const token = createAccessToken(user, roleName);
    const refreshToken = createRefreshToken(user, roleName);

    return res.status(201).json({
      token,
      refreshToken,
      user: publicUser(user, roleName),
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─────────────────────────────────────────────
// POST /auth/login
// ─────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid data",
        errors: parsed.error.flatten(),
      });
    }

    const { email, password } = parsed.data;

    const found = await db.select().from(users).where(eq(users.email, email));
    if (found.length === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = found[0];

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const roleName = await getRoleNameById(user.roleId);

    const token = createAccessToken(user, roleName);
    const refreshToken = createRefreshToken(user, roleName);

    return res.json({
      token,
      refreshToken,
      user: publicUser(user, roleName),
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─────────────────────────────────────────────
// POST /auth/refresh   (body: { refreshToken })
// ─────────────────────────────────────────────
router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body || {};

  if (!refreshToken) {
    return res.status(400).json({ message: "Refresh token is required" });
  }

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_SECRET);

    if (!payload || payload.type !== "refresh") {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const found = await db.select().from(users).where(eq(users.id, payload.id));
    if (found.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = found[0];
    const roleName = await getRoleNameById(user.roleId);

    const newAccessToken = createAccessToken(user, roleName);
    const newRefreshToken = createRefreshToken(user, roleName);

    return res.json({
      token: newAccessToken,
      refreshToken: newRefreshToken,
      user: publicUser(user, roleName),
    });
  } catch (err) {
    console.error("Refresh token error:", err);

    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Refresh token expired" });
    }

    return res.status(401).json({ message: "Invalid refresh token" });
  }
});

// ─────────────────────────────────────────────
// GET /auth/me
// ─────────────────────────────────────────────
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const found = await db.select().from(users).where(eq(users.id, userId));
    if (found.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = found[0];

    let roleName = req.user.roleName || null;
    if (!roleName) roleName = await getRoleNameById(user.roleId);

    return res.json(publicUser(user, roleName));
  } catch (err) {
    console.error("Me error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
