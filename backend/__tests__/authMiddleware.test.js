// 1) Mock jsonwebtoken so we control jwt.verify behavior
jest.mock('jsonwebtoken');

const jwt = require('jsonwebtoken');
// 2) Import the functions we are testing
const { authMiddleware, requireAdmin } = require('../src/middleware/auth');

beforeEach(() => {
  jest.clearAllMocks();
});

test('authMiddleware returns 401 when Authorization header is missing', () => {
  const req = { headers: {} };

  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  const next = jest.fn();

  authMiddleware(req, res, next);

  expect(res.statusCode).toBe(401);
  expect(res.body).toEqual({
    message: 'Missing or invalid Authorization header',
  });
  expect(next).not.toHaveBeenCalled();
});

test('authMiddleware returns 401 when scheme is not Bearer', () => {
  const req = {
    headers: {
      authorization: 'Basic sometoken',
    },
  };

  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  const next = jest.fn();

  authMiddleware(req, res, next);

  expect(res.statusCode).toBe(401);
  expect(res.body).toEqual({
    message: 'Missing or invalid Authorization header',
  });
  expect(next).not.toHaveBeenCalled();
});

test('authMiddleware attaches user to req and calls next on valid token', () => {
  const fakePayload = {
    id: 123,
    email: 'test@example.com',
    roleId: 2,
    type: 'access',
  };

  jwt.verify.mockReturnValue(fakePayload);

  const req = {
    headers: {
      authorization: 'Bearer faketoken',
    },
  };

  const res = {
    status() {
      // should not be called in this case
      throw new Error('status should not be called');
    },
    json() {
      throw new Error('json should not be called');
    },
  };

  const next = jest.fn();

  authMiddleware(req, res, next);

  expect(jwt.verify).toHaveBeenCalledWith(
    'faketoken',
    process.env.JWT_SECRET
  );
  expect(req.user).toEqual(fakePayload);
  expect(next).toHaveBeenCalledTimes(1);
});

test('authMiddleware returns 401 with "Token expired" when jwt throws TokenExpiredError', () => {
  const error = new Error('jwt expired');
  error.name = 'TokenExpiredError';
  error.expiredAt = new Date();

  jwt.verify.mockImplementation(() => {
    throw error;
  });

  const req = {
    method: 'GET',
    originalUrl: '/some/protected/route',
    headers: {
      authorization: 'Bearer expiredtoken',
    },
  };

  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  const next = jest.fn();

  authMiddleware(req, res, next);

  expect(res.statusCode).toBe(401);
  expect(res.body).toEqual({ message: 'Token expired' });
  expect(next).not.toHaveBeenCalled();
});

test('requireAdmin returns 403 when user is not admin (roleId !== 1)', () => {
  const req = {
    user: {
      id: 123,
      email: 'user@example.com',
      roleId: 2, // not admin
    },
  };

  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  const next = jest.fn();

  requireAdmin(req, res, next);

  expect(res.statusCode).toBe(403);
  expect(res.body).toEqual({ message: 'Admin access required' });
  expect(next).not.toHaveBeenCalled();
});
