/** @type {import('docs-kit').Config} */
export default {
  // ---------------------------------------------------------------------------
  // Source & Output
  // ---------------------------------------------------------------------------

  /** Directory to scan when running `docs-kit index` (no extra argument needed) */
  rootDir: ".",

  /** Output directories for generated content */
  output: {
    site: "docs-site", // `docs-kit build-site`
    docs: "docs-output", // `docs-kit build-docs`
  },

  // ---------------------------------------------------------------------------
  // File Discovery
  // ---------------------------------------------------------------------------

  include: [
    "**/*.ts",
    "**/*.tsx",
    "**/*.js",
    "**/*.jsx",
    "**/*.php",
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
    "**/docs-site/**",
    "**/docs-site-v2/**",
    "**/docs-output/**",
    "**/__tests__/**",
    "**/*.min.js",
    "**/*.bundle.js",
    "**/*.map",
    "**/*.d.ts",
    "**/package-lock.json",
    "**/yarn.lock",
    "**/pnpm-lock.yaml",
  ],

  /** Honour .gitignore rules when scanning */
  respectGitignore: true,

  /** Skip files larger than this (bytes) */
  maxFileSize: 512_000,

  // ---------------------------------------------------------------------------
  // Storage
  // ---------------------------------------------------------------------------

  /** SQLite database path */
  dbPath: ".docs-kit/index.db",

  // ---------------------------------------------------------------------------
  // LLM Provider  (uncomment and configure one block)
  // ---------------------------------------------------------------------------

  // -- Ollama (local) --
  // llm: {
  //   provider: "ollama",
  //   baseUrl: "http://localhost:11434",
  //   model: "qwen2.5:3b",
  //   embeddingModel: "nomic-embed-text:latest",
  //   maxTokens: 2000,
  //   temperature: 0.7,
  // },

  // -- OpenAI --
  // llm: {
  //   provider: "openai",
  //   apiKey: { env: "OPENAI_API_KEY" }, // reads from .env
  //   model: "gpt-4o",
  //   embeddingModel: "text-embedding-ada-002",
  //   maxTokens: 2000,
  //   temperature: 0.7,
  // },

  // -- Gemini --
  // llm: {
  //   provider: "gemini",
  //   apiKey: { env: "GEMINI_API_KEY" },
  //   model: "gemini-pro",
  //   maxTokens: 2000,
  //   temperature: 0.7,
  // },

  // -- Claude --
  // llm: {
  //   provider: "claude",
  //   apiKey: { env: "ANTHROPIC_API_KEY" },
  //   model: "claude-3-5-sonnet-20241022",
  //   maxTokens: 2000,
  //   temperature: 0.7,
  // },

  // ---------------------------------------------------------------------------
  // RAG / Embeddings  (disabled by default — expensive)
  // ---------------------------------------------------------------------------

  rag: {
    enabled: false, // set to true to build a vector index during `docs-kit index`
    chunkSize: 500, // words per chunk
    overlapSize: 50, // overlapping words between chunks
    minScore: 0.25, // minimum relevance score for knowledge-base answers
  },

  /** Language for generated LLM outputs */
  outputLanguage: "pt-BR",

  /** Prompt detail level: "brief" or "detailed" */
  promptVerbosity: "detailed",

  // ---------------------------------------------------------------------------
  // Parallel Indexing
  // ---------------------------------------------------------------------------

  indexing: {
    parallel: true, // use worker threads for faster indexing
    // maxWorkers: 4,        // cap worker count (default: CPU count - 1, max 8)
  },

  // ---------------------------------------------------------------------------
  // Coverage Integration
  // ---------------------------------------------------------------------------

  coverage: {
    enabled: false, // annotate symbols with coverage data
    lcovPath: "./coverage/lcov.info",
  },

  // ---------------------------------------------------------------------------
  // Default LLM Prompts  (override per-file via promptRules)
  // ---------------------------------------------------------------------------

  // defaultPrompts: {
  //   symbolPrompt: "Document this symbol concisely: purpose, params, return value, side effects.",
  //   docPrompt: "Update the relevant documentation section to reflect the code change. Preserve existing structure.",
  //   changePrompt: "Summarize what changed semantically, not line-by-line.",
  // },

  // ---------------------------------------------------------------------------
  // Per-file / Per-language Prompt Rules
  // ---------------------------------------------------------------------------

  promptRules: [
    // {
    //   name: "php-rule",
    //   language: "php",
    //   symbolPrompt: "Document this PHP symbol with type hints and examples.",
    // },
    // {
    //   name: "test-files",
    //   pattern: "**/*.test.ts",
    //   symbolPrompt: "Describe the test scenario and what it validates.",
    // },
  ],

  // ---------------------------------------------------------------------------
  // Architecture Guard  (uncomment to enable governance rules)
  // ---------------------------------------------------------------------------

  // archGuard: {
  //   languages: [
  //     {
  //       language: "typescript",
  //       // rules: ["ts:layer_boundary"],   // leave empty to apply ALL rules
  //       ignorePaths: ["**/*.test.ts", "**/__tests__/**"],
  //       // overrideRules: [{ code: "ts:max_complexity", config: { max: 15 } }],
  //       // excludeRules: ["ts:missing_return_type"],
  //     },
  //     {
  //       language: "php",
  //       ignorePaths: ["**/legacy/**", "**/vendor/**"],
  //     },
  //   ],
  //   customRules: [
  //     // {
  //     //   language: ["php", "typescript"],
  //     //   code: "custom:no_todo",
  //     //   description: "No TODO comments allowed",
  //     //   severity: "warning",
  //     //   check: (content) => (content.match(/TODO:/g) || []).length,
  //     // },
  //   ],
  // },

  // ---------------------------------------------------------------------------
  // Documentation Registry  (links symbols to Markdown files)
  // ---------------------------------------------------------------------------

  docs: [
    {
      path: "docs/README.md",
      title: "Introduction",
      name: "introduction",
      category: "main",
      module: "Main",
      symbols: [],
      showOnMenu: true,
      // next: "docs/architecture.md",
    },
    // {
    //   path: "docs/architecture.md",
    //   title: "Architecture",
    //   name: "architecture",
    //   category: "main",
    //   module: "Main",
    //   symbols: ["MyClass", "myFunction"],
    //   previous: "docs/README.md",
    //   showOnMenu: true,
    // },
    // Auto-discover every .md file inside a folder:
    // { path: "./docs/modules/", autoDiscovery: true, showOnMenu: true },
    // { path: "./docs/examples/", autoDiscovery: true },
  ],
};
