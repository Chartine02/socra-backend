const mockPrisma = require("../__mocks__/prisma.mock");

jest.mock("../../src/lib/prisma", () => mockPrisma);
jest.mock("../../src/lib/supabase", () => ({
  supabase: { storage: { from: jest.fn() } },
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
const {
  generateTestToken,
  TEST_USER,
} = require("../helpers");

describe("Analytics Routes — Integration", () => {
  let token;

  beforeEach(() => {
    token = generateTestToken();
  });

  describe("GET /api/analytics/knowledge-gap", () => {
    it("returns 200 with knowledge gap data", async () => {
      mockPrisma.knowledgeUnit.findMany.mockResolvedValue([
        { topic: "Math", masteryState: "SHAKY", masteryPercentage: 60, lastReviewedAt: new Date() },
      ]);
      mockPrisma.canvasQuizSubmission.findMany.mockResolvedValue([]);
      mockPrisma.canvasAssignmentSubmission.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/analytics/knowledge-gap")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("topics");
      expect(res.body.data.topics).toHaveLength(1);
    });

    it("returns 401 without auth", async () => {
      const res = await request(app).get("/api/analytics/knowledge-gap");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/analytics/retention-curve", () => {
    it("returns 200 with retention data", async () => {
      mockPrisma.flashcardReview.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/analytics/retention-curve")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("points");
    });
  });

  describe("GET /api/analytics/sessions", () => {
    it("returns 200 with study sessions", async () => {
      mockPrisma.studySession.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/analytics/sessions")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe("GET /api/analytics/sessions/:sessionId", () => {
    it("returns 404 when session not found", async () => {
      mockPrisma.studySession.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .get("/api/analytics/sessions/nonexistent")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/analytics/streak", () => {
    it("returns 200 with streak data", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        studyStreak: 5,
        lastStudiedAt: new Date("2026-01-20"),
      });

      const res = await request(app)
        .get("/api/analytics/streak")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("currentStreak", 5);
    });
  });
});
