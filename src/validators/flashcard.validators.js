const { z } = require("zod");

const generateFlashcardsSchema = z.object({
  documentId: z.string().uuid("Invalid document ID"),
});

const reviewFlashcardSchema = z.object({
  flashcardId: z.string().uuid("Invalid flashcard ID"),
  rating: z.enum(["FORGOT", "HARD", "GOOD", "EASY"]),
});

module.exports = { generateFlashcardsSchema, reviewFlashcardSchema };
