import type { ResolvedConfig } from "../../../configLoader.js";

type LlmProvider = "none" | "openai" | "ollama" | "gemini" | "claude";

interface TestConfigOptions {
  provider: LlmProvider;
  model: string;
  apiKey?: string;
  maxTokens?: number;
  temperature?: number;
  embeddingModel?: string;
  baseUrl?: string;
}

export function createTestConfig(options: TestConfigOptions): ResolvedConfig {
  return {
    projectRoot: "/test",
    include: ["**/*.ts"],
    exclude: ["**/node_modules/**"],
    respectGitignore: true,
    maxFileSize: 512_000,
    dbPath: ".docs-kit/index.db",
    promptRules: [],
    docs: [],
    defaultPrompts: {
      symbolPrompt: "test",
      docPrompt: "test",
      changePrompt: "test",
    },
    llm: {
      provider: options.provider,
      model: options.model,
      maxTokens: options.maxTokens ?? 2000,
      temperature: options.temperature ?? 0.7,
      apiKey: options.apiKey,
      embeddingModel: options.embeddingModel,
      baseUrl: options.baseUrl,
    },
  };
}
