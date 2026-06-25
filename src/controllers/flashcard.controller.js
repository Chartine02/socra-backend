const flashcardService = require("../services/flashcard.service");
const { success } = require("../utils/response.utils");

async function generate(req, res, next) {
  try {
    const { documentId } = req.body;
    const flashcards = await flashcardService.generateFlashcards({
      documentId,
      userId: req.user.id,
    });
    return success(res, flashcards);
  } catch (err) {
    next(err);
  }
}

async function review(req, res, next) {
  try {
    const { flashcardId, rating } = req.body;
    const updated = await flashcardService.reviewFlashcard({
      flashcardId,
      rating,
      userId: req.user.id,
    });
    return success(res, updated);
  } catch (err) {
    next(err);
  }
}

async function getByDocument(req, res, next) {
  try {
    const flashcards = await flashcardService.getFlashcardsByDocument(
      req.params.documentId,
      req.user.id
    );
    return success(res, flashcards);
  } catch (err) {
    next(err);
  }
}

module.exports = { generate, review, getByDocument };
