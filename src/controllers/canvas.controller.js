const canvasOAuthService = require("../services/canvas-oauth.service");
const canvasSyncService = require("../services/canvas-sync.service");
const canvasApiService = require("../services/canvas-api.service");
const canvasAnalysisService = require("../services/canvas-analysis.service");
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

// List modules for a specific course
async function getModules(req, res, next) {
  try {
    const { canvasCourseId } = req.query;
    if (!canvasCourseId) {
      return res.status(400).json({ error: "canvasCourseId query parameter required" });
    }

    const modules = await canvasSyncService.getModules(
      req.user.id,
      String(canvasCourseId),
      CANVAS_BASE_URL
    );

    return success(res, { modules });
  } catch (err) {
    next(err);
  }
}

// Sync selected modules from a course
async function syncModules(req, res, next) {
  try {
    const { canvasCourseId, moduleIds } = req.body;

    if (!canvasCourseId || !moduleIds || !Array.isArray(moduleIds) || moduleIds.length === 0) {
      return res.status(400).json({ error: "canvasCourseId and moduleIds[] are required" });
    }

    const results = await canvasSyncService.syncModules(
      req.user.id,
      String(canvasCourseId),
      CANVAS_BASE_URL,
      moduleIds.map(String)
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
      String(canvasCourseId),
      CANVAS_BASE_URL
    );

    return success(res, status);
  } catch (err) {
    next(err);
  }
}

// ─── Performance Analysis ─────────────────────────────────────────────────

async function getQuizzes(req, res, next) {
  try {
    const { canvasCourseId } = req.query;
    if (!canvasCourseId) {
      return res.status(400).json({ error: "canvasCourseId query parameter required" });
    }
    const quizzes = await canvasApiService.getQuizzes(req.user.id, CANVAS_BASE_URL, canvasCourseId);
    return success(res, { quizzes });
  } catch (err) {
    next(err);
  }
}

async function getQuizResults(req, res, next) {
  try {
    const { canvasCourseId } = req.query;
    const results = await canvasAnalysisService.getQuizResults(req.user.id, canvasCourseId);
    return success(res, { results });
  } catch (err) {
    next(err);
  }
}

async function getAssignmentResults(req, res, next) {
  try {
    const { canvasCourseId } = req.query;
    const results = await canvasAnalysisService.getAssignmentResults(req.user.id, canvasCourseId);
    return success(res, { results });
  } catch (err) {
    next(err);
  }
}

async function triggerAnalysis(req, res, next) {
  try {
    const results = await canvasAnalysisService.runAnalysisCycle(req.user.id);
    return success(res, results);
  } catch (err) {
    next(err);
  }
}

async function unsyncModule(req, res, next) {
  try {
    const { canvasCourseId, moduleId } = req.body;

    if (!canvasCourseId || !moduleId) {
      return res.status(400).json({ error: "canvasCourseId and moduleId are required" });
    }

    await canvasSyncService.unsyncModule(
      req.user.id,
      String(canvasCourseId),
      CANVAS_BASE_URL,
      String(moduleId)
    );

    return success(res, { message: "Module unsynced and all related data deleted" });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  storeToken,
  getTokenStatus,
  removeToken,
  getCourses,
  getModules,
  syncModules,
  getSyncStatus,
  getQuizzes,
  getQuizResults,
  getAssignmentResults,
  triggerAnalysis,
  unsyncModule,
};
