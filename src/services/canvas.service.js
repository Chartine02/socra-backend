// Canvas integration is split into dedicated service modules:
// - lti.service.js         — LTI 1.3 OIDC login + JWT launch validation
// - canvas-oauth.service.js — OAuth2 token management
// - canvas-api.service.js   — Canvas REST API client
// - canvas-sync.service.js  — Course content sync + AI processing

// Re-export for backward compatibility
const ltiService = require("./lti.service");
const canvasOAuthService = require("./canvas-oauth.service");
const canvasApiService = require("./canvas-api.service");
const canvasSyncService = require("./canvas-sync.service");

module.exports = {
  ...ltiService,
  ...canvasOAuthService,
  ...canvasApiService,
  ...canvasSyncService,
};
