const prisma = require("../lib/prisma");
const { supabase, BUCKET } = require("../lib/supabase");
const aiService = require("./ai.service");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

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

  // Delete file from Supabase Storage
  if (document.storageKey) {
    await supabase.storage.from(BUCKET).remove([document.storageKey]);
  }

  await prisma.document.delete({ where: { id: documentId } });
}

module.exports = { uploadDocument, getUserDocuments, getDocumentById, deleteDocument };
