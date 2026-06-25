const { Router } = require("express");
const flashcardController = require("../controllers/flashcard.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { validate } = require("../middleware/validate.middleware");
const {
  generateFlashcardsSchema,
  reviewFlashcardSchema,
} = require("../validators/flashcard.validators");

const router = Router();

router.use(authenticate);

router.post("/generate", validate(generateFlashcardsSchema), flashcardController.generate);
router.post("/review", validate(reviewFlashcardSchema), flashcardController.review);
router.get("/:documentId", flashcardController.getByDocument);

module.exports = router;
