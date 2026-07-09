const prisma = require("../lib/prisma");
const canvasApi = require("./canvas-api.service");
const aiService = require("./ai.service");
const logger = require("../utils/logger");

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

// ─── List modules for a course ────────────────────────────────────────────

async function getModules(userId, canvasCourseId, canvasBaseUrl) {
  const modules = await canvasApi.getModules(userId, canvasBaseUrl, canvasCourseId);
  return modules.map((m) => ({
    id: m.id,
    name: m.name,
    position: m.position,
    itemsCount: m.items_count || (m.items ? m.items.length : 0),
  }));
}

// ─── Sync selected modules ───────────────────────────────────────────────

async function syncModules(userId, canvasCourseId, canvasBaseUrl, moduleIds) {
  // Find or create the CanvasCourse record
  let course = await prisma.canvasCourse.findUnique({
    where: {
      userId_canvasCourseId_canvasBaseUrl: { userId, canvasCourseId, canvasBaseUrl },
    },
  });

  if (!course) {
    let courseName = "Canvas Course";
    let courseCode = null;
    try {
      const courseData = await canvasApi.getCourse(userId, canvasBaseUrl, canvasCourseId);
      courseName = courseData.name || courseName;
      courseCode = courseData.course_code || null;
    } catch (err) {
      // Continue with defaults
    }

    course = await prisma.canvasCourse.create({
      data: { userId, canvasCourseId, canvasBaseUrl, courseName, courseCode },
    });
  }

  const results = { modules: 0, documents: 0, errors: [] };

  for (const moduleId of moduleIds) {
    try {
      await syncSingleModule(userId, course, canvasBaseUrl, canvasCourseId, moduleId);
      results.modules++;
      results.documents++;
    } catch (err) {
      results.errors.push(`Module ${moduleId}: ${err.message}`);
    }
  }

  // Update last synced timestamp
  await prisma.canvasCourse.update({
    where: { id: course.id },
    data: { lastSyncedAt: new Date() },
  });

  return results;
}

// ─── Sync a single module → one Document ─────────────────────────────────

async function syncSingleModule(userId, course, canvasBaseUrl, canvasCourseId, moduleId) {
  // Fetch module items
  const items = await canvasApi.getModuleItems(userId, canvasBaseUrl, canvasCourseId, moduleId);

  // Fetch module name
  let moduleName = `Module ${moduleId}`;
  try {
    const modules = await canvasApi.getModules(userId, canvasBaseUrl, canvasCourseId);
    const mod = modules.find((m) => String(m.id) === String(moduleId));
    if (mod) moduleName = mod.name;
  } catch (err) {
    // Use default name
  }

  // Collect text from all pages in this module
  const sections = [];

  for (const item of items) {
    if (item.type === "Page") {
      try {
        const page = await canvasApi.getPage(userId, canvasBaseUrl, canvasCourseId, item.page_url);
        const text = stripHtml(page.body || "");
        if (text && text.length > 30) {
          sections.push({ title: page.title, text });
        }
      } catch (err) {
        logger.error(`Failed to fetch page ${item.page_url}: ${err.message}`);
      }
    } else if (item.type === "File") {
      // For files, we note them but skip download for now (file content goes through file URL)
      sections.push({ title: item.title, text: `[File: ${item.title}]` });
    } else if (item.type === "ExternalUrl" || item.type === "ExternalTool") {
      // Skip external links
    } else if (item.type === "SubHeader") {
      sections.push({ title: item.title, text: "" });
    }
  }

  if (sections.length === 0) {
    throw createAppError("Module has no readable content", 400);
  }

  // Combine all page text into one document
  const combinedText = sections
    .filter((s) => s.text && s.text.length > 30)
    .map((s) => `## ${s.title}\n\n${s.text}`)
    .join("\n\n---\n\n");

  if (!combinedText || combinedText.length < 100) {
    throw createAppError("Module content too short to process", 400);
  }

  // Check if we already have a document for this module
  const existingItem = await prisma.canvasContentItem.findUnique({
    where: {
      canvasCourseId_canvasItemId_itemType: {
        canvasCourseId: course.id,
        canvasItemId: String(moduleId),
        itemType: "module",
      },
    },
  });

  if (existingItem && existingItem.documentId) {
    // Already synced — update content and re-process
    await prisma.canvasContentItem.update({
      where: { id: existingItem.id },
      data: { textContent: combinedText, title: moduleName },
    });
    await prisma.document.update({
      where: { id: existingItem.documentId },
      data: { processingStatus: "PROCESSING", processingError: null, summary: null },
    });
    // Delete old knowledge units to regenerate
    await prisma.knowledgeUnit.deleteMany({ where: { documentId: existingItem.documentId } });
    processModuleAsync(existingItem.documentId, combinedText, moduleName);
    return;
  }

  // Create new Document
  const document = await prisma.document.create({
    data: {
      userId,
      fileName: `[Canvas] ${moduleName}`,
      fileSize: Buffer.byteLength(combinedText, "utf8"),
      mimeType: "text/plain",
      storageKey: `canvas/module/${moduleId}`,
      processingStatus: "PROCESSING",
    },
  });

  // Create content item linked to the document
  await prisma.canvasContentItem.create({
    data: {
      canvasCourseId: course.id,
      canvasItemId: String(moduleId),
      itemType: "module",
      title: moduleName,
      textContent: combinedText,
      documentId: document.id,
    },
  });

  // Process through AI (knowledge units + summary)
  processModuleAsync(document.id, combinedText, moduleName);
}

// ─── AI Processing (knowledge units + summary) ───────────────────────────

async function processModuleAsync(documentId, textContent, title) {
  try {
    // 1. Extract knowledge units
    const result = await aiService.processDocument({
      fileUrl: null,
      fileName: title,
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

    // 2. Generate study summary
    const summary = await aiService.generateSummary({
      textContent,
      title,
    });

    await prisma.document.update({
      where: { id: documentId },
      data: { processingStatus: "READY", summary },
    });
  } catch (err) {
    logger.error(`Module processing failed for doc ${documentId}`, {
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
        where: { itemType: "module" },
        select: {
          id: true,
          title: true,
          canvasItemId: true,
          documentId: true,
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
    modules: course.contentItems.map((item) => ({
      moduleId: item.canvasItemId,
      title: item.title,
      documentId: item.documentId,
      synced: !!item.documentId,
    })),
  };
}

module.exports = {
  getModules,
  syncModules,
  getSyncStatus,
};
