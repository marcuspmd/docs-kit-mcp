/** @type {import('docs-kit').Config} */
export default {
  // LLM Configuration
  // RECOMMENDED: Reference environment variables from .env for security
  llm: {
    provider: "openai",
    apiKey: { env: "OPENAI_API_KEY" }, // References OPENAI_API_KEY from .env
    model: "gpt-4",
    embeddingModel: "text-embedding-ada-002",
    maxTokens: 2000,
    temperature: 0.7,
  },
  // Alternative (NOT RECOMMENDED): Direct API key
  // llm: {
  //   provider: "openai",
  //   apiKey: "sk-...", // Never commit this to version control!
  //   model: "gpt-4",
  // },

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
    lcovPath: "coverage/lcov.info",
    enabled: true,
  },

  // RAG (Retrieval-Augmented Generation) Configuration
  // Control when embeddings are created during indexing
  rag: {
    enabled: false, // Set to false to skip RAG during 'docs-kit index'
    chunkSize: 500, // Words per chunk
    overlapSize: 50, // Overlapping words between chunks
  },

  // Architecture governance rules (language-specific configuration)
  archGuard: {
    // Language-specific guard configurations
    languages: [
      {
        language: "php",
        // If 'rules' is empty/undefined, ALL available PHP rules are applied
        // To whitelist specific rules, list them here:
        // rules: ["php:layer_boundary", "php:naming_class", "php:max_complexity"],

        // Glob patterns for files to ignore (violations in these files won't be reported)
        ignorePaths: [
          "**/legacy/**",
          "**/vendor/**",
        ],

        // Override specific rule configurations
        overrideRules: [
          {
            code: "php:layer_boundary",
            severity: "warning", // Change from default "error" to "warning"
            config: {
              source: "src/Domain/**",
              forbidden: ["src/Infrastructure/**"],
            },
          },
          {
            code: "php:max_complexity",
            config: {
              max: 15, // Override default max of 10
            },
          },
        ],

        // Rule codes to exclude (these won't be applied even if in whitelist)
        excludeRules: [
          "php:missing_return_type_strict",
        ],
      },
      {
        language: "typescript",
        // Apply all TypeScript rules (empty rules array = all)
        ignorePaths: [
          "**/*.test.ts",
          "**/__tests__/**",
        ],
      },
    ],

    // Custom rules that can apply across multiple languages
    customRules: [
      {
        language: ["php", "typescript", "javascript"],
        code: "custom:no_todo_comments",
        description: "Disallow TODO comments in production code",
        severity: "warning",
        check: (fileContent, _filePath) => {
          const todoRegex = /\/\/\s*TODO:/gi;
          const matches = fileContent.match(todoRegex);
          return matches ? matches.length : 0;
        },
        ignorePaths: [
          "**/LegacyCode/**",
          "**/ThirdParty/**",
        ],
      },
      {
        language: ["php"],
        code: "custom:no_die_exit",
        description: "Avoid die() and exit() calls in PHP code",
        severity: "error",
        check: (fileContent) => {
          const pattern = /\b(die|exit)\s*\(/gi;
          const matches = fileContent.match(pattern);
          return matches ? matches.length : 0;
        },
      },
    ],
  },

  docs: [
    {
      path: "docs/domain/arch-guard-rules.md",
      title: "Arch Guard Rules",
      name: "arch-guard-rules",
      category: "domain",
      module: "Main",
      symbols: ["createArchGuard", "ArchGuard", "ArchRule", "ArchViolation"],
      next: "docs/domain/projectStatus.md",
      showOnMenu: true
    },
    {
      path: "docs/domain/projectStatus.md",
      title: "Project Status",
      name: "project-status",
      category: "domain",
      module: "Main",
      symbols: ["generateProjectStatus", "ProjectStatusResult"],
      previous: "docs/domain/arch-guard-rules.md",
      showOnMenu: true
    },
    {
      path: "./docs/examples/",
      autoDiscovery: true,
      showOnMenu: true
    }
  ],

};
