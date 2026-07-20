const mockPrisma = require("../../__mocks__/prisma.mock");

jest.mock("../../../src/lib/prisma", () => mockPrisma);
jest.mock("../../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  request: jest.fn(),
}));

const notificationService = require("../../../src/services/notification.service");
const { TEST_USER, TEST_NOTIFICATION } = require("../../helpers");

describe("Notification Service", () => {
  describe("createNotification()", () => {
    it("creates a notification record", async () => {
      mockPrisma.notification.create.mockResolvedValue(TEST_NOTIFICATION);
      // Mock email path — user lookup for email
      mockPrisma.user.findUnique.mockResolvedValue({ ...TEST_USER, emailNotifications: false });

      const result = await notificationService.createNotification({
        userId: TEST_USER.id,
        type: "QUIZ_PERFORMANCE",
        title: "Quiz Performance Alert",
        message: "You scored 75%",
        data: { score: 75 },
      });

      expect(result).toEqual(TEST_NOTIFICATION);
      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: TEST_USER.id,
          type: "QUIZ_PERFORMANCE",
          title: "Quiz Performance Alert",
          message: "You scored 75%",
          data: { score: 75 },
        },
      });
    });
  });

  describe("getNotifications()", () => {
    it("returns paginated notifications with total count", async () => {
      const notifs = [TEST_NOTIFICATION];
      mockPrisma.notification.findMany.mockResolvedValue(notifs);
      mockPrisma.notification.count.mockResolvedValue(1);

      const result = await notificationService.getNotifications(TEST_USER.id, {
        limit: 20,
        offset: 0,
      });

      expect(result).toEqual({
        notifications: notifs,
        total: 1,
        limit: 20,
        offset: 0,
      });
    });

    it("filters by unreadOnly when requested", async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(0);

      await notificationService.getNotifications(TEST_USER.id, {
        unreadOnly: true,
        limit: 20,
        offset: 0,
      });

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: TEST_USER.id, isRead: false },
        })
      );
    });
  });

  describe("getUnreadCount()", () => {
    it("returns count of unread notifications", async () => {
      mockPrisma.notification.count.mockResolvedValue(5);

      const result = await notificationService.getUnreadCount(TEST_USER.id);

      expect(result).toBe(5);
      expect(mockPrisma.notification.count).toHaveBeenCalledWith({
        where: { userId: TEST_USER.id, isRead: false },
      });
    });
  });

  describe("markAsRead()", () => {
    it("marks a notification as read", async () => {
      mockPrisma.notification.findFirst.mockResolvedValue(TEST_NOTIFICATION);
      mockPrisma.notification.update.mockResolvedValue({
        ...TEST_NOTIFICATION,
        isRead: true,
      });

      const result = await notificationService.markAsRead(TEST_NOTIFICATION.id, TEST_USER.id);

      expect(result.isRead).toBe(true);
    });

    it("returns null when notification not found", async () => {
      mockPrisma.notification.findFirst.mockResolvedValue(null);

      const result = await notificationService.markAsRead("nonexistent", TEST_USER.id);

      expect(result).toBeNull();
    });
  });

  describe("markAllAsRead()", () => {
    it("updates all unread notifications for user", async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 3 });

      const result = await notificationService.markAllAsRead(TEST_USER.id);

      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: TEST_USER.id, isRead: false },
        data: { isRead: true },
      });
    });
  });
});
