const { error } = require("../utils/response.utils");

// LTI 1.3 launch verification middleware
// This is a simplified implementation — full ltijs integration
// requires platform registration done at startup in canvas.service.js
function verifyLtiLaunch(req, res, next) {
  // ltijs handles verification internally via its own routes
  // This middleware validates that the LTI context is present
  if (!req.body || !req.body.id_token) {
    return error(res, "Invalid LTI launch", 401);
  }
  next();
}

module.exports = { verifyLtiLaunch };
