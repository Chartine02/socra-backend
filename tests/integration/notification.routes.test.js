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
  TEST_NOTIFICATION,
} = require("../helpers");

describe("Notification Routes — Integration", () => {
  let token;

  beforeEach(() => {
    token = generateTestToken();
  });

  describe("GET /api/notifications", () => {
    it("returns 200 with paginated notifications", async () => {
      mockPrisma.notification.findMany.mockResolvedValue([TEST_NOTIFICATION]);
      mockPrisma.notification.count.mockResolvedValue(1);

      const res = await request(app)
        .get("/api/notifications")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("notifications");
      expect(res.body.data.notifications).toHaveLength(1);
      expect(res.body.data).toHaveProperty("total", 1);
    });

    it("supports unreadOnly filter", async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(0);

      const res = await request(app)
        .get("/api/notifications?unreadOnly=true")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it("returns 401 without auth", async () => {
      const res = await request(app).get("/api/notifications");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/notifications/unread-count", () => {
    it("returns 200 with unread count", async () => {
      mockPrisma.notification.count.mockResolvedValue(3);

      const res = await request(app)
        .get("/api/notifications/unread-count")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ count: 3 });
    });
  });

  describe("PATCH /api/notifications/:id/read", () => {
    it("returns 200 when notification marked as read", async () => {
      mockPrisma.notification.findFirst.mockResolvedValue(TEST_NOTIFICATION);
      mockPrisma.notification.update.mockResolvedValue({
        ...TEST_NOTIFICATION,
        isRead: true,
      });

      const res = await request(app)
        .patch(`/api/notifications/${TEST_NOTIFICATION.id}/read`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
    });
  });

  describe("PATCH /api/notifications/read-all", () => {
    it("returns 200 when all notifications marked as read", async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 5 });

      const res = await request(app)
        .patch("/api/notifications/read-all")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
    });
  });
});
