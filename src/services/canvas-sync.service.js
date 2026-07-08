const prisma = require("../lib/prisma");
const canvasApi = require("./canvas-api.service");
const aiService = require("./ai.service");
const logger = require("../utils/logger");
const { v4: uuidv4 } = require("uuid");

function createAppError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

// ─── Strip HTML to plain text ─────────────────────────────────────────────

function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Sync Course Content ──────────────────────────────────────────────────

async function syncCourseContent(userId, canvasCourseId, canvasBaseUrl) {
  // Find or create the CanvasCourse record
  let course = await prisma.canvasCourse.findUnique({
    where: {
      userId_canvasCourseId_canvasBaseUrl: {
        userId,
        canvasCourseId,
        canvasBaseUrl,
      },
    },
  });

  if (!course) {
    // Fetch course info from Canvas and create the record
    let courseName = "Canvas Course";
    let courseCode = null;
    try {
      const courseData = await canvasApi.getCourse(userId, canvasBaseUrl, canvasCourseId);
      courseName = courseData.name || courseName;
      courseCode = courseData.course_code || null;
    } catch (err) {
      // Continue with defaults if course fetch fails
    }

    course = await prisma.canvasCourse.create({
      data: {
        userId,
        canvasCourseId,
        canvasBaseUrl,
        courseName,
        courseCode,
      },
    });
  }

  const results = { pages: 0, files: 0, errors: [] };

  // Sync pages
  try {
    const pages = await canvasApi.getPages(userId, canvasBaseUrl, canvasCourseId);
    for (const page of pages) {
      try {
        await syncPage(userId, course.id, canvasBaseUrl, canvasCourseId, page);
        results.pages++;
      } catch (err) {
        results.errors.push(`Page "${page.title}": ${err.message}`);
      }
    }
  } catch (err) {
    results.errors.push(`Pages fetch: ${err.message}`);
  }

  // Sync files
  try {
    const files = await canvasApi.getFiles(userId, canvasBaseUrl, canvasCourseId);
    for (const file of files) {
      try {
        await syncFile(userId, course.id, canvasBaseUrl, file);
        results.files++;
      } catch (err) {
        results.errors.push(`File "${file.display_name}": ${err.message}`);
      }
    }
  } catch (err) {
    results.errors.push(`Files fetch: ${err.message}`);
  }

  // Update last synced timestamp
  await prisma.canvasCourse.update({
    where: { id: course.id },
    data: { lastSyncedAt: new Date() },
  });

  return results;
}

// ─── Sync Individual Page ─────────────────────────────────────────────────

async function syncPage(userId, courseDbId, canvasBaseUrl, canvasCourseId, pageSummary) {
  // Fetch full page content
  const page = await canvasApi.getPage(
    userId,
    canvasBaseUrl,
    canvasCourseId,
    pageSummary.url
  );

  const htmlContent = page.body || "";
  const textContent = stripHtml(htmlContent);

  // Skip empty pages
  if (!textContent || textContent.length < 50) return;

  // Upsert content item
  const contentItem = await prisma.canvasContentItem.upsert({
    where: {
      canvasCourseId_canvasItemId_itemType: {
        canvasCourseId: courseDbId,
        canvasItemId: String(page.page_id),
        itemType: "page",
      },
    },
    create: {
      canvasCourseId: courseDbId,
      canvasItemId: String(page.page_id),
      itemType: "page",
      title: page.title,
      contentUrl: page.html_url,
      htmlContent,
      textContent,
      lastModifiedAt: page.updated_at ? new Date(page.updated_at) : null,
    },
    update: {
      title: page.title,
      htmlContent,
      textContent,
      lastModifiedAt: page.updated_at ? new Date(page.updated_at) : null,
    },
  });

  // If not yet processed into a Document, create one and process it
  if (!contentItem.documentId) {
    await processContentItemAsDocument(userId, contentItem, textContent);
  }
}

// ─── Sync Individual File ─────────────────────────────────────────────────

async function syncFile(userId, courseDbId, canvasBaseUrl, fileMeta) {
  // Only process text-extractable files
  const supportedTypes = [
    "application/pdf",
    "text/plain",
    "text/html",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  if (!supportedTypes.includes(fileMeta.content_type)) return;

  // Upsert content item
  const contentItem = await prisma.canvasContentItem.upsert({
    where: {
      canvasCourseId_canvasItemId_itemType: {
        canvasCourseId: courseDbId,
        canvasItemId: String(fileMeta.id),
        itemType: "file",
      },
    },
    create: {
      canvasCourseId: courseDbId,
      canvasItemId: String(fileMeta.id),
      itemType: "file",
      title: fileMeta.display_name,
      contentUrl: fileMeta.url,
      fileSize: fileMeta.size,
      lastModifiedAt: fileMeta.modified_at ? new Date(fileMeta.modified_at) : null,
    },
    update: {
      title: fileMeta.display_name,
      contentUrl: fileMeta.url,
      fileSize: fileMeta.size,
      lastModifiedAt: fileMeta.modified_at ? new Date(fileMeta.modified_at) : null,
    },
  });

  // If not yet processed into a Document, create one and send to AI
  if (!contentItem.documentId) {
    await processFileAsDocument(userId, contentItem, canvasBaseUrl, fileMeta);
  }
}

// ─── Process page content through AI pipeline ─────────────────────────────

async function processContentItemAsDocument(userId, contentItem, textContent) {
  // Create a SOCRA Document record
  const document = await prisma.document.create({
    data: {
      userId,
      fileName: `[Canvas] ${contentItem.title}`,
      fileSize: Buffer.byteLength(textContent, "utf8"),
      mimeType: "text/html",
      storageKey: `canvas/${contentItem.id}`,
      processingStatus: "PROCESSING",
    },
  });

  // Link the content item to the document
  await prisma.canvasContentItem.update({
    where: { id: contentItem.id },
    data: { documentId: document.id },
  });

  // Process asynchronously through AI service
  processTextContentAsync(document.id, textContent, contentItem.title);
}

async function processFileAsDocument(userId, contentItem, canvasBaseUrl, fileMeta) {
  const document = await prisma.document.create({
    data: {
      userId,
      fileName: `[Canvas] ${fileMeta.display_name}`,
      fileSize: fileMeta.size || 0,
      mimeType: fileMeta.content_type,
      storageKey: `canvas/${contentItem.id}`,
      processingStatus: "PROCESSING",
    },
  });

  // Link the content item to the document
  await prisma.canvasContentItem.update({
    where: { id: contentItem.id },
    data: { documentId: document.id },
  });

  // Process via AI service using the Canvas file URL
  processFileContentAsync(document.id, fileMeta.url, fileMeta.display_name);
}

// ─── Async AI Processing ──────────────────────────────────────────────────

async function processTextContentAsync(documentId, textContent, title) {
  try {
    const result = await aiService.processDocument({
      fileUrl: null,
      fileName: title,
      documentId,
      textContent, // Pass text directly for pages
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
    logger.error(`Canvas content processing failed for doc ${documentId}`, {
      error: err.message,
    });
    await prisma.document.update({
      where: { id: documentId },
      data: { processingStatus: "ERROR", processingError: err.message },
    });
  }
}

async function processFileContentAsync(documentId, fileUrl, fileName) {
  try {
    const result = await aiService.processDocument({
      fileUrl,
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
    logger.error(`Canvas file processing failed for doc ${documentId}`, {
      error: err.message,
    });
    await prisma.document.update({
      where: { id: documentId },
      data: { processingStatus: "ERROR", processingError: err.message },
    });
  }
}

// ─── Get Sync Status ──────────────────────────────────────────────────────

async function getSyncStatus(userId, canvasCourseId, canvasBaseUrl) {
  const course = await prisma.canvasCourse.findUnique({
    where: {
      userId_canvasCourseId_canvasBaseUrl: { userId, canvasCourseId, canvasBaseUrl },
    },
    include: {
      contentItems: {
        select: {
          id: true,
          itemType: true,
          title: true,
          documentId: true,
          lastModifiedAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!course) {
    throw createAppError("Course not found", 404);
  }

  return {
    courseId: course.id,
    courseName: course.courseName,
    lastSyncedAt: course.lastSyncedAt,
    contentItems: course.contentItems.length,
    processed: course.contentItems.filter((i) => i.documentId).length,
    pending: course.contentItems.filter((i) => !i.documentId).length,
  };
}

module.exports = {
  syncCourseContent,
  getSyncStatus,
};
