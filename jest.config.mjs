/**
 * Jest configuration for DDD architecture.
 */

/** @type {import('jest').Config} */
export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@core/(.*)$": "<rootDir>/src/@core/$1",
    "^@shared/(.*)$": "<rootDir>/src/@shared/$1",
    "^@modules/(.*)$": "<rootDir>/src/modules/$1",
    "^@adapters/(.*)$": "<rootDir>/src/adapters/$1",
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
  testMatch: ["**/__tests__/**/*.test.ts", "**/*.test.ts"],
  clearMocks: true,
  restoreMocks: true,
  resetModules: true,
  forceExit: false,
  maxWorkers: 2,
  workerIdleMemoryLimit: "50MB",

  // Coverage configuration
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/main/*.ts",
    "!src/**/*.d.ts",
    "!src/**/index.ts",
    "!**/__tests__/**",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "clover", "json"],
};


