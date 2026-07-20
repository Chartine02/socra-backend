const { TEST_JWT_SECRET } = require("../../helpers");
process.env.JWT_SECRET = TEST_JWT_SECRET;

const { authenticate } = require("../../../src/middleware/auth.middleware");
const { mockRequest, mockResponse, mockNext, generateTestToken } = require("../../helpers");

describe("Auth Middleware", () => {
  describe("authenticate()", () => {
    it("sets req.user and calls next() on valid token", () => {
      const token = generateTestToken({ id: "user-1", email: "a@b.com", role: "STUDENT" });
      const req = mockRequest({
        headers: { authorization: `Bearer ${token}` },
      });
      const res = mockResponse();
      const next = mockNext();

      authenticate(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toEqual(
        expect.objectContaining({ id: "user-1", email: "a@b.com", role: "STUDENT" })
      );
    });

    it("returns 401 when no Authorization header", () => {
      const req = mockRequest({ headers: {} });
      const res = mockResponse();
      const next = mockNext();

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: "Unauthorised" })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 401 when Authorization header is not Bearer", () => {
      const req = mockRequest({
        headers: { authorization: "Basic abc123" },
      });
      const res = mockResponse();
      const next = mockNext();

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 401 on invalid token", () => {
      const req = mockRequest({
        headers: { authorization: "Bearer invalid-token" },
      });
      const res = mockResponse();
      const next = mockNext();

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 401 on expired token", () => {
      const jwt = require("jsonwebtoken");
      const expiredToken = jwt.sign(
        { id: "user-1", email: "a@b.com", role: "STUDENT" },
        TEST_JWT_SECRET,
        { expiresIn: "0s" }
      );
      const req = mockRequest({
        headers: { authorization: `Bearer ${expiredToken}` },
      });
      const res = mockResponse();
      const next = mockNext();

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
