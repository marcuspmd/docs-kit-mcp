import * as path from "node:path";
import * as fs from "node:fs";
import { ConfigSchema, type Config } from "./config.js";
import { pathToFileURL } from "node:url";

const CONFIG_FILENAMES = ["docs.config.js", "docs.config.mjs", "docs.config.cjs"];

const DEFAULT_CONFIG_CONTENT = `/** @type {import('docs-kit').Config} */
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

export async function loadConfig(workspaceRoot: string): Promise<Config> {
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

  return ConfigSchema.parse({
    projectRoot: workspaceRoot,
    ...userConfig,
  });
}
