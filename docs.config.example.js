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

  // Architecture governance rules (replaces arch-guard.json)
  archGuard: {
    rules: [
      {
        name: "layer-boundary-domain-infra",
        type: "layer_boundary",
        severity: "error",
        config: {
          from: "domain",
          to: "infrastructure",
          message: "Domain layer cannot depend on infrastructure"
        }
      },
      {
        name: "naming-convention-classes",
        type: "naming_convention",
        severity: "warning",
        config: {
          pattern: "^[A-Z][a-zA-Z0-9]*$",
          kinds: ["class", "interface"],
          message: "Classes and interfaces must be PascalCase"
        }
      },
      {
        name: "max-complexity",
        type: "max_complexity",
        severity: "warning",
        config: {
          threshold: 10,
          kinds: ["function", "method"]
        }
      },
      {
        name: "max-parameters",
        type: "max_parameters",
        severity: "warning",
        config: {
          threshold: 5,
          kinds: ["function", "method", "constructor"]
        }
      }
    ]
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
