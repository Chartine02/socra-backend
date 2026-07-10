const prisma = require("../lib/prisma");
const { supabase, BUCKET } = require("../lib/supabase");
const aiService = require("./ai.service");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const logger = require("../utils/logger");

function createAppError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function uploadDocument({ userId, file }) {
  // Upload file buffer to Supabase Storage
  const ext = path.extname(file.originalname);
  const storageKey = `${userId}/${uuidv4()}${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storageKey, file.buffer, {
      contentType: file.mimetype,
    });

  if (uploadError) {
    throw createAppError(`Storage upload failed: ${uploadError.message}`, 500);
  }

  const document = await prisma.document.create({
    data: {
      userId,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      storageKey,
      processingStatus: "PROCESSING",
    },
  });

  // Call AI service asynchronously — don't block the response
  processDocumentAsync(document.id, storageKey, file.originalname);

  return document;
}

async function processDocumentAsync(documentId, storageKey, fileName) {
  try {
    // Create a signed URL for the AI service to download the file
    const { data: signedData, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storageKey, 600); // 10 minutes

    if (signError) {
      throw new Error(`Failed to create signed URL: ${signError.message}`);
    }

    const result = await aiService.processDocument({
      fileUrl: signedData.signedUrl,
      fileName,
      documentId,
    });

    if (result.knowledgeUnits && result.knowledgeUnits.length > 0) {
      await prisma.knowledgeUnit.createMany({
        data: result.knowledgeUnits.map((ku) => ({
          documentId,
          topic: ku.topic,
          concept: ku.concept,
          sourceExcerpt: ku.sourceExcerpt,
          bloomLevel: ku.bloomLevel || "REMEMBER",
        })),
      });

      // Fetch created KUs with IDs for content generation
      const createdKUs = await prisma.knowledgeUnit.findMany({
        where: { documentId },
      });

      // Generate study summary from the knowledge units' source excerpts
      const textForSummary = result.knowledgeUnits
        .map((ku) => `## ${ku.topic}: ${ku.concept}\n\n${ku.sourceExcerpt}`)
        .join("\n\n---\n\n");

      const summary = await aiService.generateSummary({
        textContent: textForSummary,
        title: fileName,
      });

      await prisma.document.update({
        where: { id: documentId },
        data: { processingStatus: "READY", summary },
      });

      // Pre-generate study materials in the background
      preGenerateStudyMaterials(documentId, createdKUs).catch((err) => {
        logger.error(`Pre-generation failed for doc ${documentId}`, { error: err.message });
      });
    } else {
      await prisma.document.update({
        where: { id: documentId },
        data: { processingStatus: "READY" },
      });
    }
  } catch (err) {
    console.error("[processDocumentAsync] FAILED:", err.message, err.stack);
    await prisma.document.update({
      where: { id: documentId },
      data: { processingStatus: "ERROR", processingError: err.message },
    });
  }
}

async function getUserDocuments(userId) {
  return prisma.document.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileName: true,
      fileSize: true,
      mimeType: true,
      processingStatus: true,
      overallMastery: true,
      lastStudiedAt: true,
      summary: true,
      createdAt: true,
    },
  });
}

async function getDocumentById(documentId, userId) {
  const document = await prisma.document.findFirst({
    where: { id: documentId, userId },
    include: {
      knowledgeUnits: {
        select: {
          id: true,
          topic: true,
          concept: true,
          bloomLevel: true,
          masteryState: true,
          masteryPercentage: true,
          lastReviewedAt: true,
        },
      },
    },
  });

  if (!document) {
    throw createAppError("Document not found", 404);
  }

  return document;
}

async function deleteDocument(documentId, userId) {
  const document = await prisma.document.findFirst({
    where: { id: documentId, userId },
  });

  if (!document) {
    throw createAppError("Document not found", 404);
  }

  // Delete file from Supabase Storage
  if (document.storageKey) {
    await supabase.storage.from(BUCKET).remove([document.storageKey]);
  }

  // Clean up Canvas content item reference if this is a synced module
  await prisma.canvasContentItem.deleteMany({
    where: { documentId },
  });

  // Cascade deletes KnowledgeUnits, StudySessions, QuizQuestions, Flashcards, etc.
  await prisma.document.delete({ where: { id: documentId } });
}

async function reprocessDocument(documentId, userId) {
  const document = await prisma.document.findFirst({
    where: { id: documentId, userId, processingStatus: "ERROR" },
  });
  if (!document) {
    throw createAppError("Document not found or not in error state", 404);
  }

  await prisma.document.update({
    where: { id: documentId },
    data: { processingStatus: "PROCESSING", processingError: null },
  });

  // Check if it's a Canvas document (has canvasContentItem with textContent)
  const canvasItem = await prisma.canvasContentItem.findFirst({
    where: { documentId },
    select: { textContent: true },
  });

  if (canvasItem?.textContent) {
    // Canvas document — process with textContent
    processDocumentWithText(documentId, canvasItem.textContent, document.fileName);
  } else {
    // Regular upload — process via signed URL
    processDocumentAsync(documentId, document.storageKey, document.fileName);
  }

  return { id: documentId, processingStatus: "PROCESSING" };
}

async function processDocumentWithText(documentId, textContent, fileName) {
  try {
    const result = await aiService.processDocument({
      fileUrl: null,
      fileName,
      documentId,
      textContent,
    });

    if (result.knowledgeUnits && result.knowledgeUnits.length > 0) {
      await prisma.knowledgeUnit.createMany({
        data: result.knowledgeUnits.map((ku) => ({
          documentId,
          topic: ku.topic,
          concept: ku.concept,
          sourceExcerpt: ku.sourceExcerpt,
          bloomLevel: ku.bloomLevel || "REMEMBER",
        })),
      });
    }

    const summary = await aiService.generateSummary({ textContent, title: fileName });
    await prisma.document.update({
      where: { id: documentId },
      data: { processingStatus: "READY", summary },
    });
  } catch (err) {
    console.error("[processDocumentWithText] FAILED:", err.message);
    await prisma.document.update({
      where: { id: documentId },
      data: { processingStatus: "ERROR", processingError: err.message },
    });
  }
}

// ─── Pre-generate Study Materials ─────────────────────────────────────────

async function preGenerateStudyMaterials(documentId, knowledgeUnits) {
  if (!knowledgeUnits || knowledgeUnits.length === 0) return;

  const kuInputs = knowledgeUnits.map((ku) => ({
    id: ku.id,
    topic: ku.topic,
    concept: ku.concept,
    sourceExcerpt: ku.sourceExcerpt,
    bloomLevel: ku.bloomLevel || "REMEMBER",
  }));

  // Get the document to find the userId
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { userId: true },
  });
  if (!document) return;

  // Run quiz, flashcard, and socratic generation in parallel
  const results = await Promise.allSettled([
    // 1. Pre-generate quiz questions (10 questions)
    (async () => {
      const questions = await aiService.generateQuizQuestions({
        documentId,
        knowledgeUnits: kuInputs,
        count: 10,
      });

      const validKuIds = new Set(knowledgeUnits.map((ku) => ku.id));
      const fallbackKuId = knowledgeUnits[0]?.id;

      for (const q of questions) {
        const knowledgeUnitId = validKuIds.has(q.knowledgeUnitId)
          ? q.knowledgeUnitId
          : fallbackKuId;
        if (!knowledgeUnitId) continue;
        await prisma.quizQuestion.create({
          data: {
            documentId,
            knowledgeUnitId,
            questionText: q.questionText,
            options: q.options,
            correctIndex: q.correctIndex,
            bloomLevel: q.bloomLevel || "REMEMBER",
            explanation: q.explanation,
            sourceExcerpt: q.sourceExcerpt,
          },
        });
      }
      logger.info(`Pre-generated ${questions.length} quiz questions for doc ${documentId}`);
    })(),

    // 2. Pre-generate flashcards
    (async () => {
      const cards = await aiService.generateFlashcards({
        knowledgeUnits: kuInputs,
      });

      const validKuIds = new Set(knowledgeUnits.map((ku) => ku.id));
      const fallbackKuId = knowledgeUnits[0]?.id;

      for (const card of cards) {
        const knowledgeUnitId = validKuIds.has(card.knowledgeUnitId)
          ? card.knowledgeUnitId
          : fallbackKuId;
        if (!knowledgeUnitId) continue;
        await prisma.flashcard.create({
          data: {
            userId: document.userId,
            documentId,
            knowledgeUnitId,
            front: card.front,
            back: card.back,
            sourceExcerpt: card.sourceExcerpt,
          },
        });
      }
      logger.info(`Pre-generated ${cards.length} flashcards for doc ${documentId}`);
    })(),

    // 3. Pre-generate initial Socratic question (warm the LLM cache)
    (async () => {
      await aiService.startSocraticSession({
        documentId,
        knowledgeUnits: kuInputs,
      });
      logger.info(`Pre-generated Socratic question for doc ${documentId}`);
    })(),
  ]);

  for (const r of results) {
    if (r.status === "rejected") {
      logger.error(`Pre-generation step failed for doc ${documentId}`, { error: r.reason?.message });
    }
  }
}

module.exports = { uploadDocument, getUserDocuments, getDocumentById, deleteDocument, reprocessDocument, preGenerateStudyMaterials };
