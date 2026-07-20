const mockPrisma = require("../../__mocks__/prisma.mock");

jest.mock("../../../src/lib/prisma", () => mockPrisma);

const analyticsService = require("../../../src/services/analytics.service");
const { TEST_USER } = require("../../helpers");

describe("Analytics Service", () => {
  describe("getKnowledgeGap()", () => {
    it("returns aggregated topics with mastery data", async () => {
      mockPrisma.knowledgeUnit.findMany.mockResolvedValue([
        { topic: "Math", masteryState: "MASTERED", masteryPercentage: 90, lastReviewedAt: new Date() },
        { topic: "Math", masteryState: "SHAKY", masteryPercentage: 60, lastReviewedAt: new Date() },
        { topic: "Science", masteryState: "FORGOTTEN", masteryPercentage: 20, lastReviewedAt: null },
      ]);
      mockPrisma.canvasQuizSubmission.findMany.mockResolvedValue([]);
      mockPrisma.canvasAssignmentSubmission.findMany.mockResolvedValue([]);

      const result = await analyticsService.getKnowledgeGap({ userId: TEST_USER.id });

      expect(result.topics).toHaveLength(2);
      const mathTopic = result.topics.find((t) => t.topic === "Math");
      expect(mathTopic.masteryPercentage).toBe(75); // (90+60)/2
      expect(mathTopic.knowledgeUnitCount).toBe(2);
    });

    it("filters by documentId when provided", async () => {
      mockPrisma.knowledgeUnit.findMany.mockResolvedValue([]);
      mockPrisma.canvasQuizSubmission.findMany.mockResolvedValue([]);
      mockPrisma.canvasAssignmentSubmission.findMany.mockResolvedValue([]);

      await analyticsService.getKnowledgeGap({
        userId: TEST_USER.id,
        documentId: "doc-1",
      });

      expect(mockPrisma.knowledgeUnit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ documentId: "doc-1" }),
        })
      );
    });

    it("incorporates Canvas quiz weak topics", async () => {
      mockPrisma.knowledgeUnit.findMany.mockResolvedValue([]);
      mockPrisma.canvasQuizSubmission.findMany.mockResolvedValue([
        { weakTopics: ["Algebra", "Calculus"], scorePercent: 40 },
      ]);
      mockPrisma.canvasAssignmentSubmission.findMany.mockResolvedValue([]);

      const result = await analyticsService.getKnowledgeGap({ userId: TEST_USER.id });

      expect(result.topics).toHaveLength(2);
      expect(result.topics.map((t) => t.topic)).toContain("Algebra");
      expect(result.topics.map((t) => t.topic)).toContain("Calculus");
    });
  });

  describe("getRetentionCurve()", () => {
    it("returns date-aggregated mastery points", async () => {
      const date = new Date("2026-01-15T10:00:00Z");
      mockPrisma.flashcardReview.findMany.mockResolvedValue([
        { reviewedAt: date, newEaseFactor: 2.5, newInterval: 7 },
        { reviewedAt: date, newEaseFactor: 2.5, newInterval: 14 },
      ]);

      const result = await analyticsService.getRetentionCurve({ userId: TEST_USER.id });

      expect(result.points).toHaveLength(1);
      expect(result.points[0].date).toBe("2026-01-15");
      // (7/21*100 + 14/21*100) / 2 ≈ 50
      expect(result.points[0].averageMastery).toBeCloseTo(50, 0);
    });

    it("returns empty points when no reviews", async () => {
      mockPrisma.flashcardReview.findMany.mockResolvedValue([]);

      const result = await analyticsService.getRetentionCurve({ userId: TEST_USER.id });

      expect(result.points).toEqual([]);
    });
  });

  describe("getSessions()", () => {
    it("returns study sessions for user", async () => {
      const sessions = [
        { id: "s1", mode: "QUIZ", document: { fileName: "doc.pdf" } },
      ];
      mockPrisma.studySession.findMany.mockResolvedValue(sessions);

      const result = await analyticsService.getSessions(TEST_USER.id);

      expect(result).toEqual(sessions);
    });
  });

  describe("getSessionDetail()", () => {
    it("returns session with responses and dialogue", async () => {
      const session = {
        id: "s1",
        userId: TEST_USER.id,
        quizResponses: [],
        dialogueTurns: [],
        document: { fileName: "doc.pdf" },
      };
      mockPrisma.studySession.findFirst.mockResolvedValue(session);

      const result = await analyticsService.getSessionDetail("s1", TEST_USER.id);

      expect(result).toEqual(session);
    });

    it("throws 404 when session not found", async () => {
      mockPrisma.studySession.findFirst.mockResolvedValue(null);

      await expect(
        analyticsService.getSessionDetail("nonexistent", TEST_USER.id)
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe("getStreak()", () => {
    it("returns current streak and last studied date", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        studyStreak: 5,
        lastStudiedAt: new Date("2026-01-20"),
      });

      const result = await analyticsService.getStreak(TEST_USER.id);

      expect(result).toEqual({
        currentStreak: 5,
        lastStudiedAt: new Date("2026-01-20"),
      });
    });
  });
});
