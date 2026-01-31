import { z } from "zod";

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

  dbPath: z.string().default(".doc-kit/index.db"),

  promptRules: z.array(PromptRuleSchema).default([]),

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
      provider: z.enum(["openai", "anthropic"]).default("openai"),
      apiKey: z.string().optional(),
      model: z.string().default("gpt-4"),
      maxTokens: z.number().default(2000),
      temperature: z.number().default(0.7),
    })
    .default({}),
});

export type Config = z.infer<typeof ConfigSchema>;
export type PromptRule = z.infer<typeof PromptRuleSchema>;

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
