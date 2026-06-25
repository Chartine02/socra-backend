const { Router } = require("express");
const studyController = require("../controllers/study.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { validate } = require("../middleware/validate.middleware");
const {
  createSessionSchema,
  updateSessionSchema,
  socraticStartSchema,
  socraticRespondSchema,
  quizGenerateSchema,
  quizRespondSchema,
} = require("../validators/study.validators");

const router = Router();

router.use(authenticate);

// Sessions
router.post("/sessions", validate(createSessionSchema), studyController.createSession);
router.patch("/sessions/:sessionId", validate(updateSessionSchema), studyController.updateSession);

// Socratic mode
router.post("/socratic/start", validate(socraticStartSchema), studyController.startSocratic);
router.post("/socratic/respond", validate(socraticRespondSchema), studyController.respondSocratic);

// Quiz mode
router.post("/quiz/generate", validate(quizGenerateSchema), studyController.generateQuiz);
router.post("/quiz/respond", validate(quizRespondSchema), studyController.respondQuiz);

module.exports = router;
