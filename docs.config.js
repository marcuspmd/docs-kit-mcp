/** @type {import('docs-kit').Config} */
export default {
  include: [
    "**/*.ts",
    "**/*.tsx",
    "**/*.js",
    "**/*.jsx",
    "**/*.py",
    "**/*.java",
    "**/*.go",
    "**/*.rs",
  ],
  exclude: [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/out/**",
    "**/.next/**",
    "**/vendor/**",
    "**/__pycache__/**",
    "**/target/**",
    "**/.git/**",
    "**/coverage/**",
    "**/*.min.js",
    "**/*.bundle.js",
    "**/*.map",
    "**/*.d.ts",
    "**/package-lock.json",
    "**/yarn.lock",
    "**/pnpm-lock.yaml",
  ],
  respectGitignore: true,
  maxFileSize: 512_000,
  dbPath: ".doc-kit/index.db",
  promptRules: [],
  coverage: {
    lcovPath: "./coverage/lcov.info",
    enabled: true,
  },
  docs: [
    {
      path: "./docs/domain/arch-guard-rules.md",
      title: "Arch Guard Rules",
      name: "arch-guard-rules",
      category: "domain",
      module: "Main",
      symbols: ["createArchGuard", "ArchGuard", "ArchGuardRule", "ArchViolation"],
      next: "docs/domain/projectStatus.md",
      showOnMenu: true
    },
    {
      path: "./docs/domain/projectStatus.md",
      title: "Project Status",
      name: "project-status",
      category: "domain",
      module: "Main",
      symbols: ["projectStatus", "ProjectStatusReport"],
      previous: "docs/domain/arch-guard-rules.md",
      showOnMenu: true
    }
  ],

};
