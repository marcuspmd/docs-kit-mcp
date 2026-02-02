/**
 * Jest configuration with projects for proper test isolation.
 *
 * The indexer tests use tree-sitter which has global state that conflicts
 * with other tests when run in the same process. Using Jest projects ensures
 * each group runs in its own isolated environment.
 *
 * IMPORTANT: The indexer project uses forceExit and runInBand to ensure
 * complete isolation between test files due to tree-sitter's native bindings.
 */

/** @type {import('jest').Config} */
const baseConfig = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        diagnostics: false,
      },
    ],
  },
  clearMocks: true,
  restoreMocks: true,
};

export default {
  // Use projects for proper isolation
  projects: [
    {
      ...baseConfig,
      displayName: "indexer",
      roots: ["<rootDir>/tests/indexer"],
      // Critical: Run indexer tests serially in same process
      // tree-sitter has global state that requires sequential execution
      maxWorkers: 1,
      // Force fresh module cache for each test file
      workerIdleMemoryLimit: "100MB",
      // Reset modules between tests for clean tree-sitter state
      resetModules: true,
    },
    {
      ...baseConfig,
      displayName: "unit",
      roots: ["<rootDir>/tests"],
      testPathIgnorePatterns: ["/node_modules/", "/tests/indexer/"],
      // Other tests can run in parallel
      maxWorkers: "50%",
    },
  ],

  // Coverage configuration (applies to all projects)
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/**/index.ts",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "clover", "json"],
};


