module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.js"],
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/lib/**",
    "!src/utils/logger.js",
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
  // Map ESM-only modules to CJS mocks
  moduleNameMapper: {
    "^uuid$": "<rootDir>/tests/__mocks__/uuid.mock.js",
  },
  clearMocks: true,
  restoreMocks: true,
};
