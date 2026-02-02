export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      { useESM: true,
        diagnostics: false,
      },
    ],
  },
  // Increase timeout for validation tests (TypeScript compilation, etc.)
  testTimeout: 10000,
  // Force serial execution for CI/CD reliability
  // Tree-sitter parsers have global state that causes race conditions
  maxWorkers: 1,
  // Additional isolation settings
  maxConcurrency: 1,
  clearMocks: true,
  restoreMocks: true,
};
