import * as path from "node:path";
import * as fs from "node:fs";
import { ConfigSchema, type Config } from "./config.js";
import { pathToFileURL } from "node:url";
import { expandAutoDiscoveryDocs, linkDocNavigation } from "./docs/autoDiscovery.js";
import * as dotenv from "dotenv";

/** Config with resolved API key (no more env references) */
export type ResolvedConfig = Omit<Config, "llm"> & {
  llm: Omit<Config["llm"], "apiKey"> & {
    apiKey?: string;
  };
};

const CONFIG_FILENAMES = ["docs.config.js", "docs.config.mjs", "docs.config.cjs"];

const DEFAULT_CONFIG_CONTENT = `/** @type {import('docs-kit').Config} */
export default {
  // ---------------------------------------------------------------------------
  // Source & Output
  // ---------------------------------------------------------------------------

  /** Directory to scan when running \`docs-kit index\` (no extra argument needed) */
  rootDir: ".",

  /** Output directories for generated content */
  output: {
    site: "docs-site",   // \`docs-kit build-site\`
    docs: "docs-output", // \`docs-kit build-docs\`
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
    enabled: false,    // set to true to build a vector index during \`docs-kit index\`
    chunkSize: 500,    // words per chunk
    overlapSize: 50,   // overlapping words between chunks
  },

  // ---------------------------------------------------------------------------
  // Parallel Indexing
  // ---------------------------------------------------------------------------

  indexing: {
    parallel: true,         // use worker threads for faster indexing
    // maxWorkers: 4,        // cap worker count (default: CPU count - 1, max 8)
  },

  // ---------------------------------------------------------------------------
  // Coverage Integration
  // ---------------------------------------------------------------------------

  coverage: {
    enabled: false,                    // annotate symbols with coverage data
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
`;

export function configExists(workspaceRoot: string): boolean {
  return CONFIG_FILENAMES.some((f) => fs.existsSync(path.resolve(workspaceRoot, f)));
}

export function createDefaultConfig(workspaceRoot: string): string {
  const configPath = path.resolve(workspaceRoot, "docs.config.js");
  fs.writeFileSync(configPath, DEFAULT_CONFIG_CONTENT, "utf-8");
  return configPath;
}

export async function loadConfig(workspaceRoot: string): Promise<ResolvedConfig> {
  // Load .env file from workspace root
  const envPath = path.resolve(workspaceRoot, ".env");
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
  }

  let userConfig: Record<string, unknown> = {};

  for (const filename of CONFIG_FILENAMES) {
    const configPath = path.resolve(workspaceRoot, filename);
    if (fs.existsSync(configPath)) {
      const fileUrl = pathToFileURL(configPath).href;
      const imported = await import(fileUrl);
      userConfig = imported.default ?? imported;
      break;
    }
  }

  const config = ConfigSchema.parse({
    projectRoot: workspaceRoot,
    ...userConfig,
  });

  // Expand auto-discovery entries and link navigation
  if (config.docs && config.docs.length > 0) {
    const expandedDocs = await expandAutoDiscoveryDocs(config.docs, workspaceRoot);
    const linkedDocs = linkDocNavigation(expandedDocs);
    config.docs = linkedDocs;
  }

  // Resolve environment variable references in apiKey
  const resolvedApiKey = resolveApiKey(config.llm.apiKey);

  // Return config with resolved apiKey as string
  return {
    ...config,
    llm: {
      ...config.llm,
      apiKey: resolvedApiKey,
    },
  } as ResolvedConfig;
}

/**
 * Resolves API key from config, supporting both direct strings and environment variable references.
 * @param apiKey - Either a string (direct key) or { env: "VAR_NAME" } (reference to .env)
 * @returns Resolved API key string or undefined
 */
function resolveApiKey(apiKey: string | { env: string } | undefined): string | undefined {
  if (!apiKey) return undefined;
  if (typeof apiKey === "string") return apiKey;
  if (typeof apiKey === "object" && "env" in apiKey) {
    const envValue = process.env[apiKey.env];
    if (!envValue) {
      console.warn(`⚠️  Environment variable "${apiKey.env}" not found in .env`);
    }
    return envValue;
  }
  return undefined;
}
