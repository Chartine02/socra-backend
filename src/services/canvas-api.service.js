const axios = require("axios");
const { getValidToken } = require("./canvas-oauth.service");

function createAppError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

// ─── Canvas API Client ────────────────────────────────────────────────────

async function canvasRequest(userId, canvasBaseUrl, endpoint, options = {}) {
  const token = await getValidToken(userId, canvasBaseUrl);

  const url = `${canvasBaseUrl}/api/v1${endpoint}`;
  const response = await axios({
    method: options.method || "GET",
    url,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...options.headers,
    },
    params: options.params,
    data: options.data,
  });

  return response.data;
}

// Handle Canvas pagination (Link header)
async function canvasRequestPaginated(userId, canvasBaseUrl, endpoint, options = {}) {
  const token = await getValidToken(userId, canvasBaseUrl);
  const results = [];
  let url = `${canvasBaseUrl}/api/v1${endpoint}`;

  while (url) {
    const response = await axios({
      method: "GET",
      url,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      params: results.length === 0 ? { per_page: 100, ...options.params } : undefined,
    });

    results.push(...response.data);

    // Parse Link header for next page
    const linkHeader = response.headers.link || "";
    const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    url = nextMatch ? nextMatch[1] : null;
  }

  return results;
}

// ─── Course Endpoints ─────────────────────────────────────────────────────

async function getCourses(userId, canvasBaseUrl) {
  return canvasRequestPaginated(userId, canvasBaseUrl, "/courses", {
    params: { enrollment_state: "active", include: ["total_students"] },
  });
}

async function getCourse(userId, canvasBaseUrl, courseId) {
  return canvasRequest(userId, canvasBaseUrl, `/courses/${courseId}`);
}

// ─── Module Endpoints ─────────────────────────────────────────────────────

async function getModules(userId, canvasBaseUrl, courseId) {
  return canvasRequestPaginated(userId, canvasBaseUrl, `/courses/${courseId}/modules`, {
    params: { include: ["items"] },
  });
}

async function getModuleItems(userId, canvasBaseUrl, courseId, moduleId) {
  return canvasRequestPaginated(
    userId,
    canvasBaseUrl,
    `/courses/${courseId}/modules/${moduleId}/items`
  );
}

// ─── Page Endpoints ───────────────────────────────────────────────────────

async function getPages(userId, canvasBaseUrl, courseId) {
  return canvasRequestPaginated(userId, canvasBaseUrl, `/courses/${courseId}/pages`);
}

async function getPage(userId, canvasBaseUrl, courseId, pageUrl) {
  return canvasRequest(userId, canvasBaseUrl, `/courses/${courseId}/pages/${pageUrl}`);
}

// ─── File Endpoints ───────────────────────────────────────────────────────

async function getFiles(userId, canvasBaseUrl, courseId) {
  return canvasRequestPaginated(userId, canvasBaseUrl, `/courses/${courseId}/files`, {
    params: { content_types: ["application/pdf", "text/plain", "text/html"] },
  });
}

async function getFile(userId, canvasBaseUrl, fileId) {
  return canvasRequest(userId, canvasBaseUrl, `/files/${fileId}`);
}

async function downloadFile(userId, canvasBaseUrl, fileUrl) {
  const token = await getValidToken(userId, canvasBaseUrl);
  const response = await axios({
    method: "GET",
    url: fileUrl,
    headers: { Authorization: `Bearer ${token}` },
    responseType: "arraybuffer",
  });
  return response.data;
}

// ─── Assignment Endpoints ─────────────────────────────────────────────────

async function getAssignments(userId, canvasBaseUrl, courseId) {
  return canvasRequestPaginated(userId, canvasBaseUrl, `/courses/${courseId}/assignments`);
}

async function getAssignmentSubmission(userId, canvasBaseUrl, courseId, assignmentId) {
  return canvasRequest(userId, canvasBaseUrl, `/courses/${courseId}/assignments/${assignmentId}/submissions/self`, {
    params: { include: ["submission_comments"] },
  });
}

// ─── Quiz Endpoints (Classic Quizzes) ─────────────────────────────────────

async function getQuizzes(userId, canvasBaseUrl, courseId) {
  return canvasRequestPaginated(userId, canvasBaseUrl, `/courses/${courseId}/quizzes`);
}

async function getQuizSubmissions(userId, canvasBaseUrl, courseId, quizId) {
  const data = await canvasRequest(userId, canvasBaseUrl, `/courses/${courseId}/quizzes/${quizId}/submissions`);
  return data.quiz_submissions || [];
}

async function getQuizSubmissionQuestions(userId, canvasBaseUrl, submissionId, attempt) {
  const data = await canvasRequest(userId, canvasBaseUrl, `/quiz_submissions/${submissionId}/questions`, {
    params: { attempt },
  });
  return data.quiz_submission_questions || [];
}

module.exports = {
  getCourses,
  getCourse,
  getModules,
  getModuleItems,
  getPages,
  getPage,
  getFiles,
  getFile,
  downloadFile,
  getAssignments,
  getAssignmentSubmission,
  getQuizzes,
  getQuizSubmissions,
  getQuizSubmissionQuestions,
};
