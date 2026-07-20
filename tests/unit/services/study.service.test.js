const mockPrisma = require("../../__mocks__/prisma.mock");

jest.mock("../../../src/lib/prisma", () => mockPrisma);
jest.mock("../../../src/services/ai.service", () => ({
  startSocraticSession: jest.fn(),
  respondSocratic: jest.fn(),
  generateQuizQuestions: jest.fn(),
}));

const studyService = require("../../../src/services/study.service");
const aiService = require("../../../src/services/ai.service");
const { TEST_USER, TEST_DOCUMENT, TEST_SESSION, TEST_KNOWLEDGE_UNIT } = require("../../helpers");

describe("Study Service", () => {
  describe("createSession()", () => {
    it("creates a session and updates study streak", async () => {
      mockPrisma.document.findFirst.mockResolvedValue(TEST_DOCUMENT);
      mockPrisma.studySession.create.mockResolvedValue(TEST_SESSION);
      mockPrisma.user.findUnique.mockResolvedValue({
        ...TEST_USER,
        studyStreak: 0,
        lastStudiedAt: null,
      });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await studyService.createSession({
        userId: TEST_USER.id,
        documentId: TEST_DOCUMENT.id,
        mode: "QUIZ",
      });

      expect(result).toEqual(TEST_SESSION);
      expect(mockPrisma.studySession.create).toHaveBeenCalledWith({
        data: { userId: TEST_USER.id, documentId: TEST_DOCUMENT.id, mode: "QUIZ" },
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ studyStreak: 1 }),
        })
      );
    });

    it("increments streak if studied yesterday", async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      mockPrisma.document.findFirst.mockResolvedValue(TEST_DOCUMENT);
      mockPrisma.studySession.create.mockResolvedValue(TEST_SESSION);
      mockPrisma.user.findUnique.mockResolvedValue({
        ...TEST_USER,
        studyStreak: 5,
        lastStudiedAt: yesterday,
      });
      mockPrisma.user.update.mockResolvedValue({});

      await studyService.createSession({
        userId: TEST_USER.id,
        documentId: TEST_DOCUMENT.id,
        mode: "QUIZ",
      });

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ studyStreak: 6 }),
        })
      );
    });

    it("resets streak if gap > 1 day", async () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      mockPrisma.document.findFirst.mockResolvedValue(TEST_DOCUMENT);
      mockPrisma.studySession.create.mockResolvedValue(TEST_SESSION);
      mockPrisma.user.findUnique.mockResolvedValue({
        ...TEST_USER,
        studyStreak: 10,
        lastStudiedAt: threeDaysAgo,
      });
      mockPrisma.user.update.mockResolvedValue({});

      await studyService.createSession({
        userId: TEST_USER.id,
        documentId: TEST_DOCUMENT.id,
        mode: "QUIZ",
      });

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ studyStreak: 1 }),
        })
      );
    });

    it("throws 404 when document not found", async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      await expect(
        studyService.createSession({
          userId: TEST_USER.id,
          documentId: "nonexistent",
          mode: "QUIZ",
        })
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe("updateSession()", () => {
    it("updates session fields", async () => {
      mockPrisma.studySession.findFirst.mockResolvedValue(TEST_SESSION);
      mockPrisma.studySession.update.mockResolvedValue({
        ...TEST_SESSION,
        scorePercent: 85,
      });

      const result = await studyService.updateSession(
        TEST_SESSION.id,
        TEST_USER.id,
        { scorePercent: 85 }
      );

      expect(result.scorePercent).toBe(85);
      expect(mockPrisma.studySession.update).toHaveBeenCalledWith({
        where: { id: TEST_SESSION.id },
        data: expect.objectContaining({ scorePercent: 85 }),
      });
    });

    it("throws 404 when session not found", async () => {
      mockPrisma.studySession.findFirst.mockResolvedValue(null);

      await expect(
        studyService.updateSession("nonexistent", TEST_USER.id, {})
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe("startSocratic()", () => {
    it("calls AI service and stores dialogue turn", async () => {
      mockPrisma.document.findFirst.mockResolvedValue({
        ...TEST_DOCUMENT,
        knowledgeUnits: [TEST_KNOWLEDGE_UNIT],
      });
      aiService.startSocraticSession.mockResolvedValue({
        question: "What is X?",
        bloomLevel: "REMEMBER",
      });
      mockPrisma.dialogueTurn.create.mockResolvedValue({});

      const result = await studyService.startSocratic({
        sessionId: TEST_SESSION.id,
        documentId: TEST_DOCUMENT.id,
        userId: TEST_USER.id,
      });

      expect(result.question).toBe("What is X?");
      expect(mockPrisma.dialogueTurn.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          role: "ai",
          content: "What is X?",
          bloomLevel: "REMEMBER",
        }),
      });
    });

    it("throws 404 when document not found", async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      await expect(
        studyService.startSocratic({
          sessionId: TEST_SESSION.id,
          documentId: "nonexistent",
          userId: TEST_USER.id,
        })
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe("generateQuiz()", () => {
    it("returns existing unanswered questions if enough exist", async () => {
      mockPrisma.document.findFirst.mockResolvedValue({
        ...TEST_DOCUMENT,
        knowledgeUnits: [TEST_KNOWLEDGE_UNIT],
      });
      const existingQuestions = Array.from({ length: 10 }, (_, i) => ({
        id: `q-${i}`,
        questionText: `Question ${i}`,
        options: '["A","B","C","D"]',
        bloomLevel: "REMEMBER",
        responses: [], // unanswered
      }));
      mockPrisma.quizQuestion.findMany.mockResolvedValue(existingQuestions);

      const result = await studyService.generateQuiz({
        sessionId: TEST_SESSION.id,
        documentId: TEST_DOCUMENT.id,
        count: 5,
        userId: TEST_USER.id,
      });

      expect(result).toHaveLength(5);
      expect(aiService.generateQuizQuestions).not.toHaveBeenCalled();
    });

    it("throws 404 when document not found", async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      await expect(
        studyService.generateQuiz({
          sessionId: TEST_SESSION.id,
          documentId: "nonexistent",
          count: 10,
          userId: TEST_USER.id,
        })
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
