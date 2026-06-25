const prisma = require("../lib/prisma");
const aiService = require("./ai.service");

function createAppError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function uploadDocument({ userId, file }) {
  const document = await prisma.document.create({
    data: {
      userId,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      storageKey: file.path || file.filename,
      processingStatus: "PROCESSING",
    },
  });

  // Call AI service asynchronously — don't block the response
  processDocumentAsync(document.id, file.path || file.filename, file.originalname);

  return document;
}

async function processDocumentAsync(documentId, storagePath, fileName) {
  try {
    const result = await aiService.processDocument({ storagePath, fileName, documentId });

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

    await prisma.document.update({
      where: { id: documentId },
      data: { processingStatus: "READY" },
    });
  } catch (err) {
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

  await prisma.document.delete({ where: { id: documentId } });
}

module.exports = { uploadDocument, getUserDocuments, getDocumentById, deleteDocument };
