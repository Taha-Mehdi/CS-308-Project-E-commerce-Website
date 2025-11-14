const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { db } = require('../db');
const { users, roles } = require('../db/schema');
const { eq } = require('drizzle-orm');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// helper: create JWT
function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      roleId: user.roleId,
    },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );
}

// POST /auth/register
router.post('/register', async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid data', errors: parsed.error.flatten() });
    }

    const { email, password, fullName } = parsed.data;

    // Check if user exists
    const existing = await db.select().from(users).where(eq(users.email, email));
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    // Get customer role
    const roleRows = await db.select().from(roles).where(eq(roles.name, 'customer'));
    if (roleRows.length === 0) {
      return res.status(500).json({ message: 'Default role not configured' });
    }
    const customerRole = roleRows[0];

    const passwordHash = await bcrypt.hash(password, 10);

    const inserted = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        fullName,
        roleId: customerRole.id,
      })
      .returning();

    const user = inserted[0];

    const token = createToken({
      id: user.id,
      email: user.email,
      roleId: user.roleId,
    });

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        roleId: user.roleId,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid data', errors: parsed.error.flatten() });
    }

    const { email, password } = parsed.data;

    const found = await db.select().from(users).where(eq(users.email, email));
    if (found.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = found[0];

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = createToken({
      id: user.id,
      email: user.email,
      roleId: user.roleId,
    });

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        roleId: user.roleId,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /auth/me (requires Authorization: Bearer <token>)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const found = await db.select().from(users).where(eq(users.id, userId));
    if (found.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = found[0];

    return res.json({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roleId: user.roleId,
    });
  } catch (err) {
    console.error('Me error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
