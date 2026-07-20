const { TEST_JWT_SECRET } = require("../../helpers");

// Set env before requiring the module
process.env.JWT_SECRET = TEST_JWT_SECRET;
process.env.JWT_EXPIRES_IN = "1h";

const { signToken, verifyToken } = require("../../../src/utils/jwt.utils");

describe("jwt.utils", () => {
  const payload = { id: "user-123", email: "test@example.com", role: "STUDENT" };

  describe("signToken()", () => {
    it("returns a valid JWT string", () => {
      const token = signToken(payload);
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);
    });

    it("encodes payload fields", () => {
      const token = signToken(payload);
      const decoded = verifyToken(token);
      expect(decoded.id).toBe(payload.id);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
    });
  });

  describe("verifyToken()", () => {
    it("successfully decodes a valid token", () => {
      const token = signToken(payload);
      const decoded = verifyToken(token);
      expect(decoded.id).toBe("user-123");
      expect(decoded).toHaveProperty("iat");
      expect(decoded).toHaveProperty("exp");
    });

    it("throws on invalid token", () => {
      expect(() => verifyToken("invalid-token")).toThrow();
    });

    it("throws on tampered token", () => {
      const token = signToken(payload);
      const tampered = token.slice(0, -5) + "XXXXX";
      expect(() => verifyToken(tampered)).toThrow();
    });
  });
});
