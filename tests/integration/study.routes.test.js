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
  TEST_SESSION,
  TEST_KNOWLEDGE_UNIT,
} = require("../helpers");

describe("Study Routes — Integration", () => {
  let token;

  beforeEach(() => {
    token = generateTestToken();
  });

  describe("POST /api/study/sessions", () => {
    it("returns 201 on session creation", async () => {
      mockPrisma.document.findFirst.mockResolvedValue(TEST_DOCUMENT);
      mockPrisma.studySession.create.mockResolvedValue(TEST_SESSION);
      mockPrisma.user.findUnique.mockResolvedValue({
        ...TEST_USER,
        studyStreak: 0,
        lastStudiedAt: null,
      });
      mockPrisma.user.update.mockResolvedValue({});

      const res = await request(app)
        .post("/api/study/sessions")
        .set("Authorization", `Bearer ${token}`)
        .send({
          documentId: TEST_DOCUMENT.id,
          mode: "QUIZ",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("id", TEST_SESSION.id);
    });

    it("returns 400 with invalid mode", async () => {
      const res = await request(app)
        .post("/api/study/sessions")
        .set("Authorization", `Bearer ${token}`)
        .send({
          documentId: TEST_DOCUMENT.id,
          mode: "INVALID",
        });

      expect(res.status).toBe(400);
    });

    it("returns 401 without auth", async () => {
      const res = await request(app)
        .post("/api/study/sessions")
        .send({ documentId: TEST_DOCUMENT.id, mode: "QUIZ" });

      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/study/socratic/start", () => {
    it("returns 200 with initial question", async () => {
      mockPrisma.document.findFirst.mockResolvedValue({
        ...TEST_DOCUMENT,
        knowledgeUnits: [TEST_KNOWLEDGE_UNIT],
      });
      aiService.startSocraticSession.mockResolvedValue({
        question: "What is photosynthesis?",
        bloomLevel: "REMEMBER",
      });
      mockPrisma.dialogueTurn.create.mockResolvedValue({});

      const res = await request(app)
        .post("/api/study/socratic/start")
        .set("Authorization", `Bearer ${token}`)
        .send({
          sessionId: TEST_SESSION.id,
          documentId: TEST_DOCUMENT.id,
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("question");
    });
  });

  describe("POST /api/study/quiz/generate", () => {
    it("returns 200 with quiz questions", async () => {
      mockPrisma.document.findFirst.mockResolvedValue({
        ...TEST_DOCUMENT,
        knowledgeUnits: [TEST_KNOWLEDGE_UNIT],
      });
      mockPrisma.quizQuestion.findMany.mockResolvedValue([]);
      aiService.generateQuizQuestions.mockResolvedValue([
        {
          questionText: "What is X?",
          options: ["A", "B", "C", "D"],
          correctIndex: 0,
          explanation: "Because...",
          knowledgeUnitId: TEST_KNOWLEDGE_UNIT.id,
          bloomLevel: "REMEMBER",
        },
      ]);
      mockPrisma.quizQuestion.create.mockResolvedValue({
        id: "new-q",
        questionText: "What is X?",
        options: '["A","B","C","D"]',
        bloomLevel: "REMEMBER",
      });

      const res = await request(app)
        .post("/api/study/quiz/generate")
        .set("Authorization", `Bearer ${token}`)
        .send({
          sessionId: TEST_SESSION.id,
          documentId: TEST_DOCUMENT.id,
          count: 5,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
