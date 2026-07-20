const mockPrisma = require("../__mocks__/prisma.mock");

// Mock all external dependencies before requiring app
jest.mock("../../src/lib/prisma", () => mockPrisma);
jest.mock("../../src/lib/supabase", () => ({
  supabase: {
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({ data: {}, error: null }),
        createSignedUrl: jest.fn().mockResolvedValue({
          data: { signedUrl: "https://example.com/signed" },
          error: null,
        }),
        remove: jest.fn().mockResolvedValue({ data: {}, error: null }),
      }),
    },
  },
  BUCKET: "socra-documents",
}));
jest.mock("../../src/services/ai.service", () => ({
  processDocument: jest.fn(),
  generateSummary: jest.fn(),
  generateQuizQuestions: jest.fn(),
  generateFlashcards: jest.fn(),
  startSocraticSession: jest.fn(),
  respondSocratic: jest.fn(),
  analyzePerformance: jest.fn(),
}));
jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  request: jest.fn(),
}));

const { TEST_JWT_SECRET } = require("../helpers");
process.env.JWT_SECRET = TEST_JWT_SECRET;
process.env.JWT_EXPIRES_IN = "1h";

const request = require("supertest");
const app = require("../../src/app");
const bcrypt = require("bcryptjs");
const {
  generateTestToken,
  TEST_USER,
  TEST_DOCUMENT,
  TEST_KNOWLEDGE_UNIT,
  TEST_SESSION,
} = require("../helpers");

describe("Auth Routes — Integration", () => {
  describe("POST /api/auth/register", () => {
    it("returns 201 on successful registration", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: "new-id",
        email: "new@example.com",
        fullName: "New User",
        university: "Test Uni",
        role: "STUDENT",
        createdAt: new Date(),
      });

      const res = await request(app)
        .post("/api/auth/register")
        .send({
          fullName: "New User",
          email: "new@example.com",
          password: "password123",
          university: "Test Uni",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("email", "new@example.com");
    });

    it("returns 400 on validation failure", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          email: "not-valid",
          password: "short",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it("returns 409 when email already exists", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(TEST_USER);

      const res = await request(app)
        .post("/api/auth/register")
        .send({
          fullName: "Test",
          email: "test@example.com",
          password: "password123",
          university: "Uni",
        });

      expect(res.status).toBe(409);
    });
  });

  describe("POST /api/auth/login", () => {
    it("returns 200 with token on valid login", async () => {
      const hashedPw = await bcrypt.hash("password123", 4);
      mockPrisma.user.findUnique.mockResolvedValue({
        ...TEST_USER,
        passwordHash: hashedPw,
      });

      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: TEST_USER.email,
          password: "password123",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("token");
      expect(res.body.data).toHaveProperty("user");
    });

    it("returns 401 on invalid credentials", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "none@example.com",
          password: "password123",
        });

      expect(res.status).toBe(401);
    });

    it("returns 400 when email is missing", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ password: "password123" });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/auth/me", () => {
    it("returns 200 with user profile when authenticated", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(TEST_USER);
      const token = generateTestToken();

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("email", TEST_USER.email);
    });

    it("returns 401 without auth token", async () => {
      const res = await request(app).get("/api/auth/me");

      expect(res.status).toBe(401);
    });

    it("returns 401 with invalid token", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalid-token");

      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/auth/forgot-password", () => {
    it("returns 200 even when user does not exist (prevent enumeration)", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "nonexistent@example.com" });

      expect(res.status).toBe(200);
    });
  });

  describe("POST /api/auth/reset-password", () => {
    it("returns 200 on successful password reset", async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ ...TEST_USER, id: "user-1" });
      mockPrisma.user.update.mockResolvedValue({});

      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ token: "valid-token", newPassword: "newpassword123" });

      expect(res.status).toBe(200);
    });

    it("returns 400 on invalid/expired token", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ token: "expired", newPassword: "newpassword123" });

      expect(res.status).toBe(400);
    });
  });
});
