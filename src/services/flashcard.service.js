const prisma = require("../lib/prisma");
const aiService = require("./ai.service");
const { calculateSM2 } = require("./sm2.service");

function createAppError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function generateFlashcards({ documentId, userId }) {
  const document = await prisma.document.findFirst({
    where: { id: documentId, userId },
    include: { knowledgeUnits: true },
  });
  if (!document) {
    throw createAppError("Document not found", 404);
  }

  // Find knowledge units without existing flashcards for this user
  const existingFlashcards = await prisma.flashcard.findMany({
    where: { documentId, userId },
    select: { knowledgeUnitId: true },
  });

  const existingKuIds = new Set(existingFlashcards.map((f) => f.knowledgeUnitId));
  const unitsNeedingCards = document.knowledgeUnits.filter(
    (ku) => !existingKuIds.has(ku.id)
  );

  if (unitsNeedingCards.length > 0) {
    const generated = await aiService.generateFlashcards({
      knowledgeUnits: unitsNeedingCards,
    });

    for (const card of generated) {
      await prisma.flashcard.create({
        data: {
          userId,
          documentId,
          knowledgeUnitId: card.knowledgeUnitId,
          front: card.front,
          back: card.back,
          sourceExcerpt: card.sourceExcerpt,
        },
      });
    }
  }

  // Return all flashcards due for review today
  const now = new Date();
  return prisma.flashcard.findMany({
    where: {
      documentId,
      userId,
      nextReviewAt: { lte: now },
    },
    orderBy: { nextReviewAt: "asc" },
  });
}

async function reviewFlashcard({ flashcardId, rating, userId }) {
  const flashcard = await prisma.flashcard.findFirst({
    where: { id: flashcardId, userId },
  });
  if (!flashcard) {
    throw createAppError("Flashcard not found", 404);
  }

  const sm2Result = calculateSM2({
    rating,
    currentInterval: flashcard.interval,
    currentEaseFactor: flashcard.easeFactor,
    repetitions: flashcard.repetitions,
  });

  // Save review history
  await prisma.flashcardReview.create({
    data: {
      flashcardId,
      rating,
      previousInterval: flashcard.interval,
      newInterval: sm2Result.nextInterval,
      previousEaseFactor: flashcard.easeFactor,
      newEaseFactor: sm2Result.nextEaseFactor,
    },
  });

  // Update flashcard
  const updated = await prisma.flashcard.update({
    where: { id: flashcardId },
    data: {
      interval: sm2Result.nextInterval,
      easeFactor: sm2Result.nextEaseFactor,
      repetitions: sm2Result.nextRepetitions,
      nextReviewAt: sm2Result.nextReviewAt,
      masteryState: sm2Result.masteryState,
      lastRating: rating,
    },
  });

  // Update parent knowledge unit mastery state
  await prisma.knowledgeUnit.update({
    where: { id: flashcard.knowledgeUnitId },
    data: {
      masteryState: sm2Result.masteryState,
      lastReviewedAt: new Date(),
    },
  });

  return updated;
}

async function getFlashcardsByDocument(documentId, userId) {
  return prisma.flashcard.findMany({
    where: { documentId, userId },
    include: {
      reviewHistory: { orderBy: { reviewedAt: "desc" }, take: 10 },
    },
    orderBy: { nextReviewAt: "asc" },
  });
}

module.exports = { generateFlashcards, reviewFlashcard, getFlashcardsByDocument };
