const canvasOAuthService = require("../services/canvas-oauth.service");
const canvasSyncService = require("../services/canvas-sync.service");
const canvasApiService = require("../services/canvas-api.service");
const { success } = require("../utils/response.utils");

const CANVAS_BASE_URL = "https://alueducation.instructure.com";

// ─── Token Management ─────────────────────────────────────────────────────

// Student submits their Canvas personal access token
async function storeToken(req, res, next) {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({ error: "accessToken is required" });
    }

    const result = await canvasOAuthService.storePersonalToken({
      userId: req.user.id,
      canvasBaseUrl: CANVAS_BASE_URL,
      accessToken,
    });

    return success(res, result);
  } catch (err) {
    next(err);
  }
}

// Check if student has connected Canvas
async function getTokenStatus(req, res, next) {
  try {
    const connected = await canvasOAuthService.hasToken(req.user.id, CANVAS_BASE_URL);
    return success(res, { connected, canvasBaseUrl: CANVAS_BASE_URL });
  } catch (err) {
    next(err);
  }
}

// Remove stored token (disconnect Canvas)
async function removeToken(req, res, next) {
  try {
    const result = await canvasOAuthService.removeToken(req.user.id, CANVAS_BASE_URL);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}


async function getCourses(req, res, next) {
  try {
    const courses = await canvasApiService.getCourses(req.user.id, CANVAS_BASE_URL);
    return success(res, { courses });
  } catch (err) {
    next(err);
  }
}

// Trigger content sync for a course
async function syncCourse(req, res, next) {
  try {
    const { canvasCourseId } = req.body;

    if (!canvasCourseId) {
      return res.status(400).json({ error: "canvasCourseId is required" });
    }

    const results = await canvasSyncService.syncCourseContent(
      req.user.id,
      String(canvasCourseId),
      CANVAS_BASE_URL
    );

    return success(res, results);
  } catch (err) {
    next(err);
  }
}

// Get sync status for a course
async function getSyncStatus(req, res, next) {
  try {
    const { canvasCourseId } = req.query;

    if (!canvasCourseId) {
      return res.status(400).json({ error: "canvasCourseId query parameter required" });
    }

    const status = await canvasSyncService.getSyncStatus(
      req.user.id,
      canvasCourseId,
      CANVAS_BASE_URL
    );

    return success(res, status);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  storeToken,
  getTokenStatus,
  removeToken,
  getCourses,
  syncCourse,
  getSyncStatus,
};
