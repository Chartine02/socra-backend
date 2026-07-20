jest.mock("../../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  request: jest.fn(),
}));

const axios = require("axios");
jest.mock("axios", () => ({
  create: jest.fn().mockReturnValue({
    post: jest.fn(),
    get: jest.fn(),
  }),
}));

// Get the mocked client
const aiClient = axios.create();

// Now require the service (which uses the mocked axios.create)
const aiService = require("../../../src/services/ai.service");

describe("AI Service", () => {
  describe("processDocument()", () => {
    it("sends document to AI service and returns result", async () => {
      aiClient.post.mockResolvedValue({
        data: {
          knowledgeUnits: [
            { topic: "Test", concept: "Test concept", sourceExcerpt: "excerpt" },
          ],
        },
      });

      const result = await aiService.processDocument({
        fileUrl: "https://example.com/file.pdf",
        fileName: "test.pdf",
        documentId: "doc-1",
      });

      expect(result.knowledgeUnits).toHaveLength(1);
    });

    it("throws AppError on AI service failure", async () => {
      aiClient.post.mockRejectedValue(new Error("Connection refused"));

      await expect(
        aiService.processDocument({
          fileUrl: "https://example.com/file.pdf",
          fileName: "test.pdf",
          documentId: "doc-1",
        })
      ).rejects.toMatchObject({ statusCode: 502 });
    });
  });

  describe("startSocraticSession()", () => {
    it("sends knowledge units and returns question", async () => {
      aiClient.post.mockResolvedValue({
        data: { question: "What is X?", bloomLevel: "REMEMBER" },
      });

      const result = await aiService.startSocraticSession({
        documentId: "doc-1",
        knowledgeUnits: [],
      });

      expect(result.question).toBe("What is X?");
    });
  });

  describe("respondSocratic()", () => {
    it("sends student response and returns AI response", async () => {
      aiClient.post.mockResolvedValue({
        data: { response: "Good answer!", bloomLevel: "UNDERSTAND" },
      });

      const result = await aiService.respondSocratic({
        sessionId: "s1",
        studentResponse: "I think X is...",
        conversationHistory: [],
        currentBloomLevel: "REMEMBER",
      });

      expect(result.response).toBe("Good answer!");
      expect(result.bloomLevel).toBe("UNDERSTAND");
    });
  });

  describe("generateQuizQuestions()", () => {
    it("returns generated quiz questions", async () => {
      aiClient.post.mockResolvedValue({
        data: {
          questions: [
            { questionText: "Q1", options: ["A", "B", "C", "D"], correctIndex: 0 },
          ],
        },
      });

      const result = await aiService.generateQuizQuestions({
        documentId: "doc-1",
        knowledgeUnits: [],
        count: 5,
      });

      expect(result.questions).toHaveLength(1);
    });
  });

  describe("generateFlashcards()", () => {
    it("returns generated flashcards", async () => {
      aiClient.post.mockResolvedValue({
        data: [{ front: "Q", back: "A", knowledgeUnitId: "ku-1" }],
      });

      const result = await aiService.generateFlashcards({
        knowledgeUnits: [{ id: "ku-1", topic: "Test" }],
      });

      expect(result).toHaveLength(1);
    });
  });

  describe("generateSummary()", () => {
    it("returns summary text", async () => {
      aiClient.post.mockResolvedValue({
        data: { summary: "This document covers..." },
      });

      const result = await aiService.generateSummary({
        textContent: "Some text content",
        title: "Test Doc",
      });

      expect(result).toBe("This document covers...");
    });

    it("returns null on failure (non-critical)", async () => {
      aiClient.post.mockRejectedValue(new Error("AI down"));

      const result = await aiService.generateSummary({
        textContent: "text",
        title: "doc",
      });

      expect(result).toBeNull();
    });
  });
});
