/**
 * @jest-environment node
 */

const express = require("express");
const request = require("supertest");

// --- MOCKS ---
jest.mock("jsonwebtoken", () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));

jest.mock("bcrypt", () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock("../src/db", () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  pool: {
    query: jest.fn(),
  },
}));

const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { db, pool } = require("../src/db");

// --- IMPORT ROUTERS / MIDDLEWARE ---
const authRoutes = require("../src/routes/auth");
const productRoutes = require("../src/routes/products");
const {
  authMiddleware,
  optionalAuthMiddleware,
  requireAdmin,
} = require("../src/middleware/auth");

// --------------------
// Drizzle-like mocking helpers
// --------------------
function makeAwaitableQuery(result) {
  const qb = {
    where: jest.fn(() => qb),
    orderBy: jest.fn(() => qb),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return qb;
}

let selectQueue = [];
function queueSelectResults(...results) {
  selectQueue = results.slice();
}

function mockDbSelectFromQueue() {
  db.select.mockImplementation(() => ({
    from: jest.fn(() => {
      const next = selectQueue.length ? selectQueue.shift() : [];
      return makeAwaitableQuery(next);
    }),
  }));
}

function mockDbInsertReturning(returnRows) {
  db.insert.mockImplementation(() => ({
    values: jest.fn(() => ({
      returning: jest.fn(() => Promise.resolve(returnRows)),
    })),
  }));
}

// --------------------
// Build a test app that mounts your routers + health endpoints
// (without running server.listen())
// --------------------
function buildApp() {
  const app = express();
  app.use(express.json());

  // match your server.js behavior (health endpoints)
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", message: "Backend is running" });
  });

  app.get("/db-health", async (_req, res) => {
    try {
      const result = await pool.query("SELECT 1");
      res.json({ status: "ok", db: true, raw: result.rows });
    } catch (err) {
      res.status(500).json({ status: "error", db: false, message: err.message });
    }
  });

  app.use("/auth", authRoutes);
  app.use("/products", productRoutes);

  return app;
}

// --------------------
// Middleware-only test app helper
// --------------------
function createMiddlewareApp(mw) {
  const app = express();
  app.get("/test", mw, (req, res) => res.json({ ok: true, user: req.user ?? null }));
  return app;
}

describe("Backend 15-test suite (middleware + health + auth + products)", () => {
  let app;

  beforeAll(() => {
    process.env.JWT_SECRET = "test-secret";
  });

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();

    // default mock: select uses queue
    mockDbSelectFromQueue();

    // default mock tokens
    jwt.sign.mockImplementation((payload, secret, opts) => {
      // produce a deterministic token string
      const type = payload?.type || "unknown";
      const id = payload?.id ?? "x";
      return `token_${type}_${id}`;
    });
  });

  // --------------------
  // 1-4: middleware tests
  // --------------------
  test("1) authMiddleware → 401 when Authorization header missing", async () => {
    const mwApp = createMiddlewareApp(authMiddleware);
    const res = await request(mwApp).get("/test");
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Authorization/i);
  });

  test("2) authMiddleware → sets req.user and calls next when JWT valid", async () => {
    jwt.verify.mockReturnValue({ id: 7, email: "a@b.com", roleId: 2, type: "access" });

    const mwApp = createMiddlewareApp(authMiddleware);
    const res = await request(mwApp)
      .get("/test")
      .set("Authorization", "Bearer validtoken");

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: 7, email: "a@b.com", roleId: 2, type: "access" });
  });

  test("3) optionalAuthMiddleware → guest allowed (req.user=null)", async () => {
    const mwApp = createMiddlewareApp(optionalAuthMiddleware);
    const res = await request(mwApp).get("/test");
    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });

  test("4) requireAdmin → 403 when roleId !== 1", async () => {
    const app2 = express();
    app2.get(
      "/test",
      (req, _res, next) => {
        req.user = { id: 1, roleId: 2 };
        next();
      },
      requireAdmin,
      (req, res) => res.json({ ok: true })
    );

    const res = await request(app2).get("/test");
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Admin/i);
  });

  // --------------------
  // 5-7: health tests
  // --------------------
  test("5) GET /health → 200", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  test("6) GET /db-health → 200 when DB works", async () => {
    pool.query.mockResolvedValue({ rows: [{ "?column?": 1 }] });

    const res = await request(app).get("/db-health");
    expect(res.status).toBe(200);
    expect(res.body.db).toBe(true);
  });

  test("7) GET /db-health → 500 when DB fails", async () => {
    pool.query.mockRejectedValue(new Error("db down"));

    const res = await request(app).get("/db-health");
    expect(res.status).toBe(500);
    expect(res.body.db).toBe(false);
    expect(res.body.message).toMatch(/db down/i);
  });

  // --------------------
  // 8-14: auth route tests
  // --------------------
  test("8) POST /auth/register → 400 on invalid data", async () => {
    const res = await request(app).post("/auth/register").send({
      email: "not-an-email",
      password: "123", // too short
      fullName: "",
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid data");
    expect(res.body.errors).toBeTruthy();
  });

  test("9) POST /auth/register → 409 when email already exists", async () => {
    // first select: users by email -> existing found
    queueSelectResults([{ id: 1, email: "x@y.com" }]);
    mockDbSelectFromQueue();

    const res = await request(app).post("/auth/register").send({
      email: "x@y.com",
      password: "123456",
      fullName: "X",
    });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already registered/i);
  });

  test("10) POST /auth/register → 201 success returns tokens + public user", async () => {
    // select #1: users by email -> none
    // select #2: roles where name='customer' -> role exists
    queueSelectResults(
      [],
      [{ id: 2, name: "customer" }]
    );
    mockDbSelectFromQueue();

    bcrypt.hash.mockResolvedValue("hashed_pw");

    // insert returning created user row
    mockDbInsertReturning([
      { id: 123, email: "new@user.com", fullName: "New User", roleId: 2, passwordHash: "hashed_pw" },
    ]);

    const res = await request(app).post("/auth/register").send({
      email: "new@user.com",
      password: "123456",
      fullName: "New User",
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toMatch(/^token_access_123$/);
    expect(res.body.refreshToken).toMatch(/^token_refresh_123$/);
    expect(res.body.user).toEqual({
      id: 123,
      email: "new@user.com",
      fullName: "New User",
      roleId: 2,
    });
  });

  test("11) POST /auth/login → 401 when user not found", async () => {
    // select: users by email -> []
    queueSelectResults([]);
    mockDbSelectFromQueue();

    const res = await request(app).post("/auth/login").send({
      email: "missing@user.com",
      password: "123456",
    });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Invalid email or password/i);
  });

  test("12) POST /auth/login → 401 when password mismatch", async () => {
    queueSelectResults([
      { id: 5, email: "a@b.com", fullName: "A B", roleId: 2, passwordHash: "hash" },
    ]);
    mockDbSelectFromQueue();

    bcrypt.compare.mockResolvedValue(false);

    const res = await request(app).post("/auth/login").send({
      email: "a@b.com",
      password: "wrongpass",
    });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Invalid email or password/i);
  });

  test("13) POST /auth/refresh → 401 when token type is not refresh", async () => {
    jwt.verify.mockReturnValue({ id: 1, type: "access" });

    const res = await request(app).post("/auth/refresh").send({
      refreshToken: "not-a-refresh-token",
    });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Invalid refresh token/i);
  });

  test("14) GET /auth/me → 200 returns public user", async () => {
    // authMiddleware reads jwt.verify(accessToken)
    jwt.verify.mockReturnValue({ id: 55, email: "me@me.com", roleId: 2, type: "access" });

    // db select by id -> user exists
    queueSelectResults([
      { id: 55, email: "me@me.com", fullName: "Me User", roleId: 2, passwordHash: "hash" },
    ]);
    mockDbSelectFromQueue();

    const res = await request(app)
      .get("/auth/me")
      .set("Authorization", "Bearer access_token_here");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 55,
      email: "me@me.com",
      fullName: "Me User",
      roleId: 2,
    });
  });

  // --------------------
  // 15: product route test
  // --------------------
  test("15) GET /products/:id → 404 when product not found", async () => {
    queueSelectResults([]); // select by id returns []
    mockDbSelectFromQueue();

    const res = await request(app).get("/products/999999");
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });
});
