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
router.get("/modules", authenticate, canvasController.getModules);
router.post("/sync", authenticate, canvasController.syncModules);
router.delete("/sync", authenticate, canvasController.unsyncModule);
router.get("/sync/status", authenticate, canvasController.getSyncStatus);

// ─── Performance Analysis ─────────────────────────────────────────────────
router.get("/quizzes", authenticate, canvasController.getQuizzes);
router.get("/quiz-results", authenticate, canvasController.getQuizResults);
router.get("/assignment-results", authenticate, canvasController.getAssignmentResults);
router.post("/analyze", authenticate, canvasController.triggerAnalysis);

module.exports = router;
