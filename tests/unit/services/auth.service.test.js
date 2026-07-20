const mockPrisma = require("../../__mocks__/prisma.mock");

// Mock prisma before requiring the service
jest.mock("../../../src/lib/prisma", () => mockPrisma);
jest.mock("../../../src/utils/jwt.utils", () => ({
  signToken: jest.fn().mockReturnValue("mock-jwt-token"),
  verifyToken: jest.fn(),
}));

const bcrypt = require("bcryptjs");
const authService = require("../../../src/services/auth.service");
const { TEST_USER } = require("../../helpers");

describe("Auth Service", () => {
  describe("register()", () => {
    const input = {
      email: "new@example.com",
      password: "password123",
      fullName: "New User",
      university: "Test Uni",
    };

    it("creates a new user with hashed password", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: "new-uuid",
        email: input.email,
        fullName: input.fullName,
        university: input.university,
        role: "STUDENT",
        createdAt: new Date(),
      });

      const result = await authService.register(input);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: input.email },
      });
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: input.email,
            fullName: input.fullName,
            university: input.university,
            isEmailVerified: true,
          }),
        })
      );
      // Password should be hashed, not stored in plain text
      const createCall = mockPrisma.user.create.mock.calls[0][0];
      expect(createCall.data.passwordHash).not.toBe(input.password);
      expect(result.user).toHaveProperty("email", input.email);
    });

    it("throws 409 when email already exists", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(TEST_USER);

      await expect(authService.register(input)).rejects.toMatchObject({
        message: "A user with this email already exists",
        statusCode: 409,
      });
    });
  });

  describe("login()", () => {
    it("returns token and user on valid credentials", async () => {
      const hashedPw = await bcrypt.hash("password123", 4);
      mockPrisma.user.findUnique.mockResolvedValue({
        ...TEST_USER,
        passwordHash: hashedPw,
      });

      const result = await authService.login({
        email: TEST_USER.email,
        password: "password123",
      });

      expect(result.token).toBe("mock-jwt-token");
      expect(result.user).toHaveProperty("email", TEST_USER.email);
    });

    it("throws 401 when user not found", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({ email: "none@example.com", password: "password" })
      ).rejects.toMatchObject({
        message: "Invalid email or password",
        statusCode: 401,
      });
    });

    it("throws 401 on wrong password", async () => {
      const hashedPw = await bcrypt.hash("correct-password", 4);
      mockPrisma.user.findUnique.mockResolvedValue({
        ...TEST_USER,
        passwordHash: hashedPw,
      });

      await expect(
        authService.login({ email: TEST_USER.email, password: "wrong-password" })
      ).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it("throws 401 when user has no passwordHash (LTI user)", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...TEST_USER,
        passwordHash: null,
      });

      await expect(
        authService.login({ email: TEST_USER.email, password: "password" })
      ).rejects.toMatchObject({
        statusCode: 401,
      });
    });
  });

  describe("verifyEmail()", () => {
    it("marks email as verified when token matches", async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ ...TEST_USER, id: "user-1" });
      mockPrisma.user.update.mockResolvedValue({});

      await authService.verifyEmail({ token: "valid-token" });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { isEmailVerified: true, emailVerifyToken: null },
      });
    });

    it("throws 400 on invalid token", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        authService.verifyEmail({ token: "invalid" })
      ).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });

  describe("forgotPassword()", () => {
    it("generates reset token for existing user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(TEST_USER);
      mockPrisma.user.update.mockResolvedValue({});

      const resetToken = await authService.forgotPassword({ email: TEST_USER.email });

      expect(typeof resetToken).toBe("string");
      expect(resetToken.length).toBeGreaterThan(0);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            resetToken: expect.any(String),
            resetTokenExpiry: expect.any(Date),
          }),
        })
      );
    });

    it("returns silently when user not found (prevents enumeration)", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await authService.forgotPassword({ email: "none@example.com" });

      expect(result).toBeUndefined();
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe("resetPassword()", () => {
    it("updates password with valid token", async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ ...TEST_USER, id: "user-1" });
      mockPrisma.user.update.mockResolvedValue({});

      await authService.resetPassword({ token: "valid-token", newPassword: "newpass123" });

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-1" },
          data: expect.objectContaining({
            passwordHash: expect.any(String),
            resetToken: null,
            resetTokenExpiry: null,
          }),
        })
      );
    });

    it("throws 400 on invalid/expired token", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        authService.resetPassword({ token: "expired", newPassword: "newpass123" })
      ).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });

  describe("getMe()", () => {
    it("returns user profile", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(TEST_USER);

      const result = await authService.getMe(TEST_USER.id);

      expect(result).toEqual(TEST_USER);
    });

    it("throws 404 when user not found", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(authService.getMe("nonexistent")).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });
});
