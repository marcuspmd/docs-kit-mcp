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
    enabled: false,
  },
  docs: [
    {
      path: "docs/example.md",
      title: "Example Document",
      name: "example",
      category: "domain",
      module: "Example",
      symbols: ["exampleFunction", "ExampleClass"],
      next: "docs/example2.md",
      showOnMenu: true
    },
    {
      path: "docs/example2.md",
      title: "Example Document 2",
      name: "example-2",
      category: "domain",
      module: "Example",
      symbols: ["exampleFunction2", "ExampleClass2"],
      previous: "docs/example.md",
      showOnMenu: true
    },
    {
      path: "./docs/examplesFolder/",
      autoDiscovery: true
    }
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
