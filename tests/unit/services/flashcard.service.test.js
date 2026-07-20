const mockPrisma = require("../../__mocks__/prisma.mock");

jest.mock("../../../src/lib/prisma", () => mockPrisma);
jest.mock("../../../src/services/ai.service", () => ({
  generateFlashcards: jest.fn(),
}));
jest.mock("../../../src/services/study.service", () => ({
  recalculateDocumentMastery: jest.fn(),
}));

const flashcardService = require("../../../src/services/flashcard.service");
const aiService = require("../../../src/services/ai.service");
const { TEST_USER, TEST_DOCUMENT, TEST_KNOWLEDGE_UNIT, TEST_FLASHCARD } = require("../../helpers");

describe("Flashcard Service", () => {
  describe("generateFlashcards()", () => {
    it("generates flashcards for KUs missing cards", async () => {
      mockPrisma.document.findFirst.mockResolvedValue({
        ...TEST_DOCUMENT,
        knowledgeUnits: [TEST_KNOWLEDGE_UNIT],
      });
      mockPrisma.flashcard.findMany
        .mockResolvedValueOnce([]) // no existing flashcards
        .mockResolvedValueOnce([TEST_FLASHCARD]); // return after creation

      aiService.generateFlashcards.mockResolvedValue([
        {
          knowledgeUnitId: TEST_KNOWLEDGE_UNIT.id,
          front: "What is X?",
          back: "X is Y.",
          sourceExcerpt: "excerpt",
        },
      ]);
      mockPrisma.flashcard.create.mockResolvedValue(TEST_FLASHCARD);

      const result = await flashcardService.generateFlashcards({
        documentId: TEST_DOCUMENT.id,
        userId: TEST_USER.id,
      });

      expect(aiService.generateFlashcards).toHaveBeenCalled();
      expect(mockPrisma.flashcard.create).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it("skips AI generation when all KUs already have cards", async () => {
      mockPrisma.document.findFirst.mockResolvedValue({
        ...TEST_DOCUMENT,
        knowledgeUnits: [TEST_KNOWLEDGE_UNIT],
      });
      mockPrisma.flashcard.findMany
        .mockResolvedValueOnce([{ knowledgeUnitId: TEST_KNOWLEDGE_UNIT.id }])
        .mockResolvedValueOnce([TEST_FLASHCARD]);

      const result = await flashcardService.generateFlashcards({
        documentId: TEST_DOCUMENT.id,
        userId: TEST_USER.id,
      });

      expect(aiService.generateFlashcards).not.toHaveBeenCalled();
    });

    it("throws 404 when document not found", async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      await expect(
        flashcardService.generateFlashcards({
          documentId: "nonexistent",
          userId: TEST_USER.id,
        })
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe("reviewFlashcard()", () => {
    it("applies SM2 algorithm and updates flashcard", async () => {
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

      const result = await flashcardService.reviewFlashcard({
        flashcardId: TEST_FLASHCARD.id,
        rating: "GOOD",
        userId: TEST_USER.id,
      });

      expect(mockPrisma.flashcardReview.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          flashcardId: TEST_FLASHCARD.id,
          rating: "GOOD",
        }),
      });
      expect(mockPrisma.flashcard.update).toHaveBeenCalled();
    });

    it("throws 404 when flashcard not found", async () => {
      mockPrisma.flashcard.findFirst.mockResolvedValue(null);

      await expect(
        flashcardService.reviewFlashcard({
          flashcardId: "nonexistent",
          rating: "GOOD",
          userId: TEST_USER.id,
        })
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
