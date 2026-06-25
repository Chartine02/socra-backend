const canvasService = require("../services/canvas.service");
const { success } = require("../utils/response.utils");

async function ltiLaunch(req, res, next) {
  try {
    const result = await canvasService.handleLtiLaunch(req.body);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

module.exports = { ltiLaunch };
