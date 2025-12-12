const {
    authMiddleware,
    optionalAuthMiddleware,
    requireAdmin
} = require('../src/middleware/auth');
const jwt = require('jsonwebtoken');

// Mock the library
jest.mock('jsonwebtoken');

describe('Auth Middleware Comprehensive Tests', () => {
    let req, res, next;

    beforeEach(() => {
        req = { headers: {}, user: null, method: 'GET', originalUrl: '/test' };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        next = jest.fn();
    });

    // --- CRITICAL PATH TESTS (The Basics) ---

    test('1. authMiddleware returns 401 if no authorization header', () => {
        req.headers = {};
        authMiddleware(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    test('2. optionalAuthMiddleware lets guests pass without error', () => {
        req.headers = {};
        optionalAuthMiddleware(req, res, next);
        expect(req.user).toBeNull();
        expect(next).toHaveBeenCalled();
    });

    test('3. optionalAuthMiddleware identifies user if token is valid', () => {
        req.headers = { authorization: 'Bearer valid_token' };
        const fakeUser = { id: 1, roleId: 2 };
        jwt.verify.mockReturnValue(fakeUser); // Mock SUCCESS

        optionalAuthMiddleware(req, res, next);

        expect(req.user).toEqual(fakeUser);
        expect(next).toHaveBeenCalled();
    });

    test('4. requireAdmin returns 403 if user is not admin (roleId 2)', () => {
        req.user = { id: 2, roleId: 2 };
        requireAdmin(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
    });

    test('5. requireAdmin calls next() if user is admin (roleId 1)', () => {
        req.user = { id: 1, roleId: 1 };
        requireAdmin(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    // --- EDGE CASE TESTS (The Advanced Stuff) ---

    // EDGE CASE 1: Malformed/Garbage Token
    // Why: Ensures the server doesn't crash when sent bad data.
    test('6. optionalAuthMiddleware gracefully handles malformed/garbage tokens', () => {
        req.headers = { authorization: 'Bearer THIS_IS_NOT_A_JWT' };

        // Mock the library throwing a generic error (like "JsonWebTokenError")
        jwt.verify.mockImplementation(() => {
            throw new Error('invalid token');
        });

        optionalAuthMiddleware(req, res, next);

        // EXPECTATION: It should NOT crash. It should just treat me as a guest (null).
        expect(req.user).toBeNull();
        expect(next).toHaveBeenCalled();
    });

    // EDGE CASE 2: Expired Token
    // Why: Ensures we distinguish between "Bad Token" and "Time-out".
    test('7. authMiddleware specifically catches TokenExpiredError', () => {
        req.headers = { authorization: 'Bearer expired_token' };

        // Mock a specific "TokenExpiredError"
        const expirationError = new Error('jwt expired');
        expirationError.name = 'TokenExpiredError';
        expirationError.expiredAt = new Date();

        jwt.verify.mockImplementation(() => {
            throw expirationError;
        });

        authMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: 'Token expired' });
    });
});