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
    '**/__tests__/**',
  ],
  respectGitignore: true,
  maxFileSize: 512_000,
  dbPath: ".docs-kit/index.db",
  promptRules: [],
  coverage: {
    lcovPath: "./coverage/lcov.info",
    enabled: true,
  },
  // RAG (Retrieval-Augmented Generation) Configuration
  // Control when embeddings are created during indexing
  // Useful to disable if you only want LLM for doc generation, not for search
  rag: {
    enabled: false, // Set to false to skip expensive embeddings during index
    chunkSize: 500, // Words per chunk (optional)
    overlapSize: 50, // Overlapping words between chunks (optional)
  },
  // Architecture governance rules (language-specific configuration)
  // archGuard: {
  //   languages: [
  //     {
  //       language: "php",
  //       // Empty rules = apply ALL available PHP rules
  //       // rules: ["php:layer_boundary", "php:naming_class"],
  //       ignorePaths: ["**/legacy/**", "**/vendor/**"],
  //       overrideRules: [
  //         { code: "php:max_complexity", config: { max: 15 } }
  //       ],
  //       excludeRules: ["php:missing_return_type_strict"]
  //     },
  //     {
  //       language: "typescript",
  //       ignorePaths: ["**/*.test.ts", "**/__tests__/**"]
  //     }
  //   ],
  //   customRules: [
  //     {
  //       language: ["php", "typescript"],
  //       code: "custom:no_todo",
  //       description: "No TODO comments",
  //       severity: "warning",
  //       check: (content) => (content.match(/TODO:/g) || []).length
  //     }
  //   ]
  // },

  // llm: {
  //   provider: "ollama",
  //   model: "qwen2.5:3b",
  //   embeddingModel: "nomic-embed-text:latest",
  //   baseUrl: "http://localhost:11434",
  // },
  // To use OpenAI instead, uncomment below and set your .env file:
  // llm: {
  //   provider: "openai",
  //   apiKey: { env: "OPENAI_API_KEY" }, // References .env
  //   model: "gpt-5",
  //   embeddingModel: "text-embedding-ada-002",
  // },
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
      symbols: ["createArchGuard", "ArchGuard", "ArchRule", "ArchViolation"],
      next: "docs/domain/projectStatus.md",
      showOnMenu: true
    },
    {
      path: "./docs/domain/projectStatus.md",
      title: "Project Status",
      name: "project-status",
      category: "domain",
      module: "Main",
      symbols: ["generateProjectStatus", "ProjectStatusResult"],
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
