const notificationService = require("../services/notification.service");
const { success } = require("../utils/response.utils");

async function getNotifications(req, res, next) {
  try {
    const { unreadOnly, limit, offset } = req.query;
    const result = await notificationService.getNotifications(req.user.id, {
      unreadOnly: unreadOnly === "true",
      limit: Math.min(parseInt(limit) || 20, 50),
      offset: parseInt(offset) || 0,
    });
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

async function getUnreadCount(req, res, next) {
  try {
    const count = await notificationService.getUnreadCount(req.user.id);
    return success(res, { count });
  } catch (err) {
    next(err);
  }
}

async function markAsRead(req, res, next) {
  try {
    const { id } = req.params;
    const notification = await notificationService.markAsRead(id, req.user.id);
    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }
    return success(res, notification);
  } catch (err) {
    next(err);
  }
}

async function markAllAsRead(req, res, next) {
  try {
    await notificationService.markAllAsRead(req.user.id);
    return success(res, { message: "All notifications marked as read" });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};
