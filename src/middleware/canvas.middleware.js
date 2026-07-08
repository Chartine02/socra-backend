const { error } = require("../utils/response.utils");

// Validate that the user has instructor role (for admin endpoints)
function requireInstructor(req, res, next) {
  if (!req.user || req.user.role !== "INSTRUCTOR") {
    return error(res, "Instructor access required", 403);
  }
  next();
}

// Validate Canvas base URL format
function validateCanvasUrl(req, res, next) {
  const canvasBaseUrl = req.query.canvasBaseUrl || req.body.canvasBaseUrl;
  if (canvasBaseUrl) {
    try {
      const url = new URL(canvasBaseUrl);
      if (!url.protocol.startsWith("https")) {
        return error(res, "Canvas URL must use HTTPS", 400);
      }
    } catch {
      return error(res, "Invalid Canvas URL format", 400);
    }
  }
  next();
}

module.exports = { requireInstructor, validateCanvasUrl };
