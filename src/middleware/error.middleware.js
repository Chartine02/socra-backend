const multer = require("multer");
const logger = require("../utils/logger");

function errorHandler(err, req, res, next) {
  // Multer errors (file upload issues)
  if (err instanceof multer.MulterError) {
    const msg = err.code === "LIMIT_FILE_SIZE" ? "File too large (max 10MB)" : err.message;
    return res.status(400).json({ success: false, message: msg });
  }
  if (err.message && err.message.includes("Only PDF and plain text files")) {
    return res.status(400).json({ success: false, message: err.message });
  }

  // Prisma known errors
  if (err.code === "P2002") {
    return res.status(409).json({ success: false, message: "Already exists" });
  }
  if (err.code === "P2025") {
    return res.status(404).json({ success: false, message: "Not found" });
  }

  // Custom AppError
  if (err.statusCode) {
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }

  // Unhandled errors
  logger.error("Unhandled error", {
    message: err.message,
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });

  return res.status(500).json({ success: false, message: err.message || "Internal server error" });
}

module.exports = { errorHandler };
