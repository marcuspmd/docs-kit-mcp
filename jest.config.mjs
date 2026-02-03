/**
 * Jest configuration with tree-sitter isolation.
 *
 * The indexer tests use tree-sitter which has global state.
 * Managed via resetModules and aggressive cleanup between test files.
 */

/** @type {import('jest').Config} */
export default {
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
  testMatch: ["**.test.ts"],
  clearMocks: true,
  restoreMocks: true,
  resetModules: true,
  forceExit: false,
  // Isolate tree-sitter state: restart workers periodically
  maxWorkers: 2,
  workerIdleMemoryLimit: "50MB",
  // Setup file for cleanup between tests
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup.ts"],

  // Coverage configuration
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/cli.ts",
    "!src/server.ts",
    "!src/configLoader.ts",
    "!src/**/*.d.ts",
    "!src/**/index.ts",
    "!**/__tests__/**",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "clover", "json"],
};


