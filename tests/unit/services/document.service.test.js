const mockPrisma = require("../../__mocks__/prisma.mock");

const mockStorageBucket = {
  upload: jest.fn().mockResolvedValue({ data: {}, error: null }),
  createSignedUrl: jest.fn().mockResolvedValue({
    data: { signedUrl: "https://storage.example.com/signed-url" },
    error: null,
  }),
  remove: jest.fn().mockResolvedValue({ data: {}, error: null }),
};

jest.mock("../../../src/lib/prisma", () => mockPrisma);
jest.mock("../../../src/lib/supabase", () => ({
  supabase: {
    storage: {
      from: () => mockStorageBucket,
    },
  },
  BUCKET: "socra-documents",
}));
jest.mock("../../../src/services/ai.service", () => ({
  processDocument: jest.fn(),
  generateSummary: jest.fn(),
  generateQuizQuestions: jest.fn(),
  generateFlashcards: jest.fn(),
  startSocraticSession: jest.fn(),
}));
jest.mock("../../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  request: jest.fn(),
}));

const documentService = require("../../../src/services/document.service");
const { TEST_USER, TEST_DOCUMENT } = require("../../helpers");

describe("Document Service", () => {
  describe("uploadDocument()", () => {
    it("uploads file to Supabase and creates document record", async () => {
      mockPrisma.document.create.mockResolvedValue(TEST_DOCUMENT);

      const file = {
        originalname: "test.pdf",
        mimetype: "application/pdf",
        size: 1024,
        buffer: Buffer.from("test content"),
      };

      const result = await documentService.uploadDocument({
        userId: TEST_USER.id,
        file,
      });

      expect(result).toEqual(TEST_DOCUMENT);
      expect(mockPrisma.document.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: TEST_USER.id,
          fileName: "test.pdf",
          fileSize: 1024,
          mimeType: "application/pdf",
          processingStatus: "PROCESSING",
        }),
      });
    });

    it("throws on Supabase upload failure", async () => {
      mockStorageBucket.upload.mockResolvedValueOnce({
        data: null,
        error: { message: "Storage full" },
      });

      const file = {
        originalname: "test.pdf",
        mimetype: "application/pdf",
        size: 1024,
        buffer: Buffer.from("test content"),
      };

      await expect(
        documentService.uploadDocument({ userId: TEST_USER.id, file })
      ).rejects.toMatchObject({
        statusCode: 500,
      });
    });
  });

  describe("getUserDocuments()", () => {
    it("returns user documents ordered by createdAt desc", async () => {
      mockPrisma.document.findMany.mockResolvedValue([TEST_DOCUMENT]);

      const result = await documentService.getUserDocuments(TEST_USER.id);

      expect(result).toEqual([TEST_DOCUMENT]);
      expect(mockPrisma.document.findMany).toHaveBeenCalledWith({
        where: { userId: TEST_USER.id },
        orderBy: { createdAt: "desc" },
        select: expect.any(Object),
      });
    });
  });

  describe("getDocumentById()", () => {
    it("returns document with knowledge units", async () => {
      mockPrisma.document.findFirst.mockResolvedValue({
        ...TEST_DOCUMENT,
        knowledgeUnits: [],
      });

      const result = await documentService.getDocumentById(TEST_DOCUMENT.id, TEST_USER.id);

      expect(result).toHaveProperty("knowledgeUnits");
    });

    it("throws 404 when document not found", async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      await expect(
        documentService.getDocumentById("nonexistent", TEST_USER.id)
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe("deleteDocument()", () => {
    it("deletes document, storage file, and canvas references", async () => {
      mockPrisma.document.findFirst.mockResolvedValue(TEST_DOCUMENT);
      mockPrisma.canvasContentItem.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.document.delete.mockResolvedValue({});

      await documentService.deleteDocument(TEST_DOCUMENT.id, TEST_USER.id);

      expect(mockPrisma.canvasContentItem.deleteMany).toHaveBeenCalledWith({
        where: { documentId: TEST_DOCUMENT.id },
      });
      expect(mockPrisma.document.delete).toHaveBeenCalledWith({
        where: { id: TEST_DOCUMENT.id },
      });
    });

    it("throws 404 when document not found", async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      await expect(
        documentService.deleteDocument("nonexistent", TEST_USER.id)
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe("reprocessDocument()", () => {
    it("throws 404 when document is not in error state", async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      await expect(
        documentService.reprocessDocument("doc-1", TEST_USER.id)
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
