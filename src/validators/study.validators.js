const { z } = require("zod");

const createSessionSchema = z.object({
  documentId: z.string().uuid("Invalid document ID"),
  mode: z.enum(["SOCRATIC", "QUIZ", "FLASHCARD"]),
});

const updateSessionSchema = z.object({
  endedAt: z.string().datetime().optional(),
  itemsCompleted: z.number().int().min(0).optional(),
  finalBloomLevel: z.enum(["REMEMBER", "UNDERSTAND", "APPLY", "ANALYSE", "EVALUATE", "CREATE"]).optional(),
  scorePercent: z.number().min(0).max(100).optional(),
});

const socraticStartSchema = z.object({
  sessionId: z.string().uuid("Invalid session ID"),
  documentId: z.string().uuid("Invalid document ID"),
});

const socraticRespondSchema = z.object({
  sessionId: z.string().uuid("Invalid session ID"),
  content: z.string().min(1, "Content is required"),
  currentBloomLevel: z.enum(["REMEMBER", "UNDERSTAND", "APPLY", "ANALYSE", "EVALUATE", "CREATE"]),
});

const quizGenerateSchema = z.object({
  sessionId: z.string().uuid("Invalid session ID"),
  documentId: z.string().uuid("Invalid document ID"),
  count: z.number().int().min(1).max(50).default(10),
});

const quizRespondSchema = z.object({
  sessionId: z.string().uuid("Invalid session ID"),
  questionId: z.string().uuid("Invalid question ID"),
  selectedIndex: z.number().int().min(0).max(3),
  confidenceRating: z.enum(["GUESSING", "UNSURE", "CONFIDENT"]),
  timeTakenSeconds: z.number().int().min(0).optional(),
});

module.exports = {
  createSessionSchema,
  updateSessionSchema,
  socraticStartSchema,
  socraticRespondSchema,
  quizGenerateSchema,
  quizRespondSchema,
};
