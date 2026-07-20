const mockPrisma = require("../__mocks__/prisma.mock");

jest.mock("../../src/lib/prisma", () => mockPrisma);
jest.mock("../../src/services/ai.service", () => ({
  processDocument: jest.fn(),
  generateSummary: jest.fn(),
  generateQuizQuestions: jest.fn(),
  generateFlashcards: jest.fn(),
  startSocraticSession: jest.fn(),
  respondSocratic: jest.fn(),
  analyzePerformance: jest.fn(),
}));
jest.mock("../../src/lib/supabase", () => ({
  supabase: { storage: { from: jest.fn() } },
  BUCKET: "socra-documents",
}));
jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  request: jest.fn(),
}));
jest.mock("../../src/services/study.service", () => ({
  recalculateDocumentMastery: jest.fn(),
}));

const { TEST_JWT_SECRET } = require("../helpers");
process.env.JWT_SECRET = TEST_JWT_SECRET;
process.env.JWT_EXPIRES_IN = "1h";

const request = require("supertest");
const app = require("../../src/app");
const aiService = require("../../src/services/ai.service");
const {
  generateTestToken,
  TEST_USER,
  TEST_DOCUMENT,
  TEST_KNOWLEDGE_UNIT,
  TEST_FLASHCARD,
} = require("../helpers");

describe("Flashcard Routes — Integration", () => {
  let token;

  beforeEach(() => {
    token = generateTestToken();
  });

  describe("POST /api/flashcards/generate", () => {
    it("returns 200 with generated flashcards", async () => {
      mockPrisma.document.findFirst.mockResolvedValue({
        ...TEST_DOCUMENT,
        knowledgeUnits: [TEST_KNOWLEDGE_UNIT],
      });
      mockPrisma.flashcard.findMany
        .mockResolvedValueOnce([]) // no existing
        .mockResolvedValueOnce([TEST_FLASHCARD]); // after generation

      aiService.generateFlashcards.mockResolvedValue([
        {
          knowledgeUnitId: TEST_KNOWLEDGE_UNIT.id,
          front: "What is X?",
          back: "X is Y.",
          sourceExcerpt: "excerpt",
        },
      ]);
      mockPrisma.flashcard.create.mockResolvedValue(TEST_FLASHCARD);

      const res = await request(app)
        .post("/api/flashcards/generate")
        .set("Authorization", `Bearer ${token}`)
        .send({ documentId: TEST_DOCUMENT.id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("returns 400 with invalid documentId", async () => {
      const res = await request(app)
        .post("/api/flashcards/generate")
        .set("Authorization", `Bearer ${token}`)
        .send({ documentId: "not-a-uuid" });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/flashcards/review", () => {
    it("returns 200 on successful review", async () => {
      mockPrisma.flashcard.findFirst.mockResolvedValue(TEST_FLASHCARD);
      mockPrisma.flashcardReview.create.mockResolvedValue({});
      mockPrisma.flashcard.update.mockResolvedValue({
        ...TEST_FLASHCARD,
        interval: 1,
        repetitions: 1,
      });
      mockPrisma.flashcard.findMany.mockResolvedValue([
        { ...TEST_FLASHCARD, interval: 1 },
      ]);
      mockPrisma.knowledgeUnit.findUnique.mockResolvedValue({
        ...TEST_KNOWLEDGE_UNIT,
        masteryPercentage: 0,
      });
      mockPrisma.knowledgeUnit.update.mockResolvedValue({});

      const res = await request(app)
        .post("/api/flashcards/review")
        .set("Authorization", `Bearer ${token}`)
        .send({
          flashcardId: TEST_FLASHCARD.id,
          rating: "GOOD",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("returns 400 with invalid rating", async () => {
      const res = await request(app)
        .post("/api/flashcards/review")
        .set("Authorization", `Bearer ${token}`)
        .send({
          flashcardId: TEST_FLASHCARD.id,
          rating: "TERRIBLE",
        });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/flashcards/:documentId", () => {
    it("returns 200 with flashcards for document", async () => {
      mockPrisma.flashcard.findMany.mockResolvedValue([TEST_FLASHCARD]);

      const res = await request(app)
        .get(`/api/flashcards/${TEST_DOCUMENT.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it("returns 401 without auth", async () => {
      const res = await request(app)
        .get(`/api/flashcards/${TEST_DOCUMENT.id}`);

      expect(res.status).toBe(401);
    });
  });
});
