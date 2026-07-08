const { Router } = require("express");
const canvasController = require("../controllers/canvas.controller");
const { authenticate } = require("../middleware/auth.middleware");

const router = Router();

// All Canvas routes require authentication (student logs in normally first)

// ─── Token Management ─────────────────────────────────────────────────────
router.post("/token", authenticate, canvasController.storeToken);
router.get("/token/status", authenticate, canvasController.getTokenStatus);
router.delete("/token", authenticate, canvasController.removeToken);

// ─── Canvas Data ──────────────────────────────────────────────────────────
router.get("/courses", authenticate, canvasController.getCourses);
router.post("/sync", authenticate, canvasController.syncCourse);
router.get("/sync/status", authenticate, canvasController.getSyncStatus);

module.exports = router;
