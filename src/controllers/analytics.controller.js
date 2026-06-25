const analyticsService = require("../services/analytics.service");
const { success } = require("../utils/response.utils");

async function knowledgeGap(req, res, next) {
  try {
    const result = await analyticsService.getKnowledgeGap({
      userId: req.user.id,
      documentId: req.query.documentId,
    });
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

async function retentionCurve(req, res, next) {
  try {
    const result = await analyticsService.getRetentionCurve({
      userId: req.user.id,
      documentId: req.query.documentId,
    });
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

async function sessions(req, res, next) {
  try {
    const result = await analyticsService.getSessions(req.user.id);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

async function sessionDetail(req, res, next) {
  try {
    const result = await analyticsService.getSessionDetail(
      req.params.sessionId,
      req.user.id
    );
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

async function streak(req, res, next) {
  try {
    const result = await analyticsService.getStreak(req.user.id);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

async function summary(req, res, next) {
  try {
    const result = await analyticsService.getSummary(req.user.id);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

module.exports = { knowledgeGap, retentionCurve, sessions, sessionDetail, streak, summary };
