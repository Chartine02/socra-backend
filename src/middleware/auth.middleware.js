const { verifyToken } = require("../utils/jwt.utils");
const { error } = require("../utils/response.utils");

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return error(res, "Unauthorised", 401);
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyToken(token);
    req.user = { id: decoded.id, email: decoded.email, role: decoded.role };
    next();
  } catch (err) {
    return error(res, "Unauthorised", 401);
  }
}

module.exports = { authenticate };
