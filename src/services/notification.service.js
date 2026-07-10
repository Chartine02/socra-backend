const prisma = require("../lib/prisma");
const logger = require("../utils/logger");

async function createNotification({ userId, type, title, message, data }) {
  const notification = await prisma.notification.create({
    data: { userId, type, title, message, data },
  });

  // Send email asynchronously (don't block)
  sendEmailIfEnabled(userId, { type, title, message, data }).catch((err) => {
    logger.error("Failed to send email notification", { error: err.message, userId });
  });

  return notification;
}

async function getNotifications(userId, { unreadOnly = false, limit = 20, offset = 0 } = {}) {
  const where = { userId };
  if (unreadOnly) where.isRead = false;

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
    }),
    prisma.notification.count({ where }),
  ]);

  return { notifications, total, limit, offset };
}

async function getUnreadCount(userId) {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

async function markAsRead(notificationId, userId) {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });
  if (!notification) return null;

  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
}

async function markAllAsRead(userId) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}

// ─── Email Integration ────────────────────────────────────────────────────

async function sendEmailIfEnabled(userId, { type, title, message, data }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, fullName: true, emailNotifications: true },
  });

  if (!user || !user.emailNotifications) return;

  // Lazy-load email service to avoid circular deps
  const emailService = require("./email.service");
  await emailService.sendPerformanceEmail({
    to: user.email,
    name: user.fullName,
    type,
    title,
    message,
    data,
  });

  await prisma.notification.updateMany({
    where: { userId, title, emailSent: false },
    data: { emailSent: true },
  });
}

module.exports = {
  createNotification,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};
