const logger = require("../utils/logger");

function errorHandler(err, req, res, next) {
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

  return res.status(500).json({ success: false, message: "Internal server error" });
}

module.exports = { errorHandler };
