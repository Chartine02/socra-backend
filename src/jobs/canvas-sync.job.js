const cron = require("node-cron");
const prisma = require("../lib/prisma");
const canvasAnalysisService = require("../services/canvas-analysis.service");
const logger = require("../utils/logger");

let isRunning = false;

async function runCanvasSyncJob() {
  if (isRunning) {
    logger.info("[Canvas Sync Job] Already running, skipping");
    return;
  }

  isRunning = true;
  logger.info("[Canvas Sync Job] Starting daily Canvas performance sync");

  try {
    // Find all users with connected Canvas tokens
    const usersWithCanvas = await prisma.canvasToken.findMany({
      where: { expiresAt: { gt: new Date() } },
      select: { userId: true },
    });

    const uniqueUserIds = [...new Set(usersWithCanvas.map((t) => t.userId))];
    logger.info(`[Canvas Sync Job] Processing ${uniqueUserIds.length} users`);

    let successCount = 0;
    let errorCount = 0;

    for (const userId of uniqueUserIds) {
      try {
        const results = await canvasAnalysisService.runAnalysisCycle(userId);
        if (results.analyzed > 0) {
          logger.info(`[Canvas Sync Job] User ${userId}: analyzed ${results.analyzed} submissions`);
        }
        successCount++;
      } catch (err) {
        logger.error(`[Canvas Sync Job] Failed for user ${userId}`, { error: err.message });
        errorCount++;
      }
    }

    logger.info(`[Canvas Sync Job] Completed. Success: ${successCount}, Errors: ${errorCount}`);
  } catch (err) {
    logger.error("[Canvas Sync Job] Fatal error", { error: err.message });
  } finally {
    isRunning = false;
  }
}

function startCanvasSyncScheduler() {
  // Run once every 24 hours at 2:00 AM
  cron.schedule("0 2 * * *", runCanvasSyncJob, {
    timezone: "UTC",
  });

  logger.info("[Canvas Sync Job] Scheduler started — runs daily at 02:00 UTC");
}

module.exports = { startCanvasSyncScheduler, runCanvasSyncJob };
