/**
 * Integration test setup — creates a configured Express app with mocked dependencies.
 * This allows testing the full HTTP request lifecycle: routing → middleware → controller → service
 */
const { TEST_JWT_SECRET, generateTestToken } = require("./helpers");

// Set required env vars before any app code loads
process.env.JWT_SECRET = TEST_JWT_SECRET;
process.env.JWT_EXPIRES_IN = "1h";
process.env.AI_SERVICE_URL = "http://localhost:9999";
process.env.AI_SERVICE_API_KEY = "test-key";
process.env.SUPABASE_URL = "http://localhost:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

module.exports = { generateTestToken };
