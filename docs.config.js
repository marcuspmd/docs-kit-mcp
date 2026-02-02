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
  dbPath: ".docs-kit/index.db",
  promptRules: [],
  coverage: {
    lcovPath: "./coverage/lcov.info",
    enabled: true,
  },
  // llm: {
  //   provider: "ollama",
  //   model: "qwen2.5:3b",
  //   embeddingModel: "nomic-embed-text:latest",
  //   baseUrl: "http://localhost:11434",
  // },
  // To use OpenAI instead, uncomment below and set your .env file:
  llm: {
    provider: "openai",
    apiKey: { env: "OPENAI_API_KEY" }, // References .env
    model: "gpt-5",
    embeddingModel: "text-embedding-ada-002",
  },
  docs: [
    {
      path: "./docs/README.md",
      title: "Introduction",
      name: "introduction",
      category: "main",
      module: "Main",
      symbols: [],
      next: "docs/domain/arch-guard-rules.md",
      showOnMenu: true,
    },
    {
      path: "./docs/ARCHITECTURE.md",
      title: "Architecture Overview",
      name: "architecture-overview",
      category: "main",
      module: "Main",
      symbols: [],
      showOnMenu: true,
    },
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
    },
    {
      path: "./docs/modules/",
      autoDiscovery: true,
      showOnMenu: true
    },
    {
      path: "./docs/examples/",
      autoDiscovery: true,
      showOnMenu: true
    }
  ],

};
