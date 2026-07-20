const mockPrisma = require("../__mocks__/prisma.mock");

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
const {
  generateTestToken,
  TEST_USER,
  TEST_DOCUMENT,
} = require("../helpers");

describe("Document Routes — Integration", () => {
  let token;

  beforeEach(() => {
    token = generateTestToken();
  });

  describe("POST /api/documents", () => {
    it("returns 201 when file is uploaded", async () => {
      mockPrisma.document.create.mockResolvedValue(TEST_DOCUMENT);

      const res = await request(app)
        .post("/api/documents")
        .set("Authorization", `Bearer ${token}`)
        .attach("file", Buffer.from("test content"), {
          filename: "test.pdf",
          contentType: "application/pdf",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("fileName");
    });

    it("returns 400 when no file is provided", async () => {
      const res = await request(app)
        .post("/api/documents")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it("returns 401 without authentication", async () => {
      const res = await request(app)
        .post("/api/documents")
        .attach("file", Buffer.from("content"), {
          filename: "test.pdf",
          contentType: "application/pdf",
        });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/documents", () => {
    it("returns 200 with user documents", async () => {
      mockPrisma.document.findMany.mockResolvedValue([TEST_DOCUMENT]);

      const res = await request(app)
        .get("/api/documents")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it("returns 401 without authentication", async () => {
      const res = await request(app).get("/api/documents");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/documents/:documentId", () => {
    it("returns 200 with document details", async () => {
      mockPrisma.document.findFirst.mockResolvedValue({
        ...TEST_DOCUMENT,
        knowledgeUnits: [],
      });

      const res = await request(app)
        .get(`/api/documents/${TEST_DOCUMENT.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("id", TEST_DOCUMENT.id);
    });

    it("returns 404 when document not found", async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .get("/api/documents/nonexistent-id")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/documents/:documentId", () => {
    it("returns 200 on successful delete", async () => {
      mockPrisma.document.findFirst.mockResolvedValue(TEST_DOCUMENT);
      mockPrisma.canvasContentItem.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.document.delete.mockResolvedValue({});

      const res = await request(app)
        .delete(`/api/documents/${TEST_DOCUMENT.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("returns 404 when document not found", async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .delete("/api/documents/nonexistent-id")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});
