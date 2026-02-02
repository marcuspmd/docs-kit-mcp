import { z } from "zod";

const ArchRuleSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  type: z.enum([
    "layer_boundary",
    "forbidden_import",
    "naming_convention",
    "max_complexity",
    "max_parameters",
    "max_lines",
    "missing_return_type",
  ]),
  severity: z.enum(["error", "warning"]).optional(),
  config: z.record(z.unknown()),
});

const PromptRuleSchema = z
  .object({
    name: z.string(),
    language: z.string().optional(),
    pattern: z.string().optional(),
    symbolPrompt: z.string().optional(),
    docPrompt: z.string().optional(),
    changePrompt: z.string().optional(),
    context: z.string().optional(),
    contextFile: z.string().optional(),
  })
  .refine((r) => r.language || r.pattern, {
    message: "Each rule must have at least `language` or `pattern`",
  });

export const DocEntrySchema = z.object({
  path: z.string(),
  title: z.string().optional(),
  name: z.string().optional(),
  category: z.string().optional(),
  module: z.string().optional(),
  symbols: z.array(z.string()).optional(),
  previous: z.string().optional(),
  next: z.string().optional(),
  /** Show this doc in the sidebar menu. Defaults to false. */
  showOnMenu: z.boolean().optional(),
  /** Auto-discover all .md files in this directory. Only valid when path is a directory. */
  autoDiscovery: z.boolean().optional(),
});

export type DocEntry = z.infer<typeof DocEntrySchema>;

export const ConfigSchema = z.object({
  projectRoot: z.string(),

  include: z
    .array(z.string())
    .default([
      "**/*.ts",
      "**/*.tsx",
      "**/*.js",
      "**/*.jsx",
      "**/*.py",
      "**/*.java",
      "**/*.go",
      "**/*.rs",
    ]),

  exclude: z
    .array(z.string())
    .default([
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
    ]),

  respectGitignore: z.boolean().default(true),

  maxFileSize: z.number().default(512_000),

  dbPath: z.string().default(".docs-kit/index.db"),

  promptRules: z.array(PromptRuleSchema).default([]),

  docs: z.array(DocEntrySchema).default([]),

  coverage: z
    .object({
      lcovPath: z.string().default("coverage/lcov.info"),
      enabled: z.boolean().default(false),
    })
    .optional(),

  defaultPrompts: z
    .object({
      symbolPrompt: z
        .string()
        .default("Document this symbol concisely: purpose, params, return value, side effects."),
      docPrompt: z
        .string()
        .default(
          "Update the relevant documentation section to reflect the code change. Preserve existing structure.",
        ),
      changePrompt: z.string().default("Summarize what changed semantically, not line-by-line."),
    })
    .default({}),

  llm: z
    .object({
      provider: z.enum(["none", "openai", "ollama", "gemini", "claude"]).default("none"),
      apiKey: z
        .union([
          z.string(), // Direct API key (not recommended for production)
          z.object({ env: z.string() }), // Reference to environment variable
        ])
        .optional(),
      model: z.string().default("gpt-4"),
      embeddingModel: z.string().optional(),
      baseUrl: z.string().optional(),
      maxTokens: z.number().default(2000),
      temperature: z.number().default(0.7),
    })
    .default({}),

  archGuard: z
    .object({
      rules: z.array(ArchRuleSchema).default([]),
    })
    .optional(),
});

export type Config = z.infer<typeof ConfigSchema>;
export type PromptRule = z.infer<typeof PromptRuleSchema>;
export type ArchRule = z.infer<typeof ArchRuleSchema>;

export function resolvePrompts(
  config: Config,
  file: { language?: string; path: string },
): { symbolPrompt: string; docPrompt: string; changePrompt: string } {
  for (const rule of config.promptRules) {
    const languageMatch = !rule.language || rule.language === file.language;
    const patternMatch = !rule.pattern || minimatch(file.path, rule.pattern);
    if (languageMatch && patternMatch) {
      return {
        symbolPrompt: rule.symbolPrompt ?? config.defaultPrompts.symbolPrompt,
        docPrompt: rule.docPrompt ?? config.defaultPrompts.docPrompt,
        changePrompt: rule.changePrompt ?? config.defaultPrompts.changePrompt,
      };
    }
  }
  return { ...config.defaultPrompts };
}

function minimatch(path: string, pattern: string): boolean {
  const regex = pattern
    .replace(/\./g, "\\.")
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/\{\{GLOBSTAR\}\}/g, ".*");
  return new RegExp(`^${regex}$`).test(path);
}

export { minimatch };
