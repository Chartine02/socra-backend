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

    const validKuIds = new Set(document.knowledgeUnits.map((ku) => ku.id));
    const fallbackKuId = document.knowledgeUnits[0]?.id;

    for (const card of generated) {
      const knowledgeUnitId = validKuIds.has(card.knowledgeUnitId)
        ? card.knowledgeUnitId
        : fallbackKuId;
      if (!knowledgeUnitId) continue;
      await prisma.flashcard.create({
        data: {
          userId,
          documentId,
          knowledgeUnitId,
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

  // Update parent knowledge unit — aggregate across all flashcards for this KU
  const allFlashcardsForKu = await prisma.flashcard.findMany({
    where: { knowledgeUnitId: flashcard.knowledgeUnitId, userId },
    select: { interval: true, masteryState: true },
  });

  // Average mastery across all flashcards for this KU
  let kuMasteryPercentage = 0;
  if (allFlashcardsForKu.length > 0) {
    kuMasteryPercentage = allFlashcardsForKu.reduce((sum, fc) => {
      return sum + Math.min(100, (fc.interval / 21) * 100);
    }, 0) / allFlashcardsForKu.length;
  }

  let kuMasteryState = 'FORGOTTEN';
  if (kuMasteryPercentage >= 80) kuMasteryState = 'MASTERED';
  else if (kuMasteryPercentage >= 50) kuMasteryState = 'SHAKY';

  // Only update KU if flashcard-derived mastery is higher than existing (quiz may have set it higher)
  const currentKu = await prisma.knowledgeUnit.findUnique({ where: { id: flashcard.knowledgeUnitId } });
  const finalPercentage = Math.max(currentKu.masteryPercentage, kuMasteryPercentage);
  let finalState = 'FORGOTTEN';
  if (finalPercentage >= 80) finalState = 'MASTERED';
  else if (finalPercentage >= 50) finalState = 'SHAKY';

  await prisma.knowledgeUnit.update({
    where: { id: flashcard.knowledgeUnitId },
    data: {
      masteryPercentage: Math.round(finalPercentage * 10) / 10,
      masteryState: finalState,
      lastReviewedAt: new Date(),
    },
  });

  // Recalculate document-level mastery
  const { recalculateDocumentMastery } = require('./study.service');
  await recalculateDocumentMastery(flashcard.documentId);

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
