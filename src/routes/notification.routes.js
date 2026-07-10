const { Router } = require("express");
const notificationController = require("../controllers/notification.controller");
const { authenticate } = require("../middleware/auth.middleware");

const router = Router();

router.get("/", authenticate, notificationController.getNotifications);
router.get("/unread-count", authenticate, notificationController.getUnreadCount);
router.patch("/read-all", authenticate, notificationController.markAllAsRead);
router.patch("/:id/read", authenticate, notificationController.markAsRead);

module.exports = router;
