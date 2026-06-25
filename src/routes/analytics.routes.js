const { Router } = require("express");
const analyticsController = require("../controllers/analytics.controller");
const { authenticate } = require("../middleware/auth.middleware");

const router = Router();

router.use(authenticate);

router.get("/knowledge-gap", analyticsController.knowledgeGap);
router.get("/retention-curve", analyticsController.retentionCurve);
router.get("/sessions", analyticsController.sessions);
router.get("/sessions/:sessionId", analyticsController.sessionDetail);
router.get("/streak", analyticsController.streak);
router.get("/summary", analyticsController.summary);

module.exports = router;
