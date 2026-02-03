import { createLlmProvider } from "../provider.js";
import type { ResolvedConfig } from "../../configLoader.js";

type ProviderType = "openai" | "ollama" | "gemini" | "claude";

describe("createLlmProvider", () => {
  const createMockConfig = (provider: ProviderType): ResolvedConfig => {
    const config = {
      llm: {
        provider: provider,
        apiKey: "test-key",
        model: "gpt-4",
        maxTokens: 4096,
        temperature: 0.7,
      },
      projectRoot: "/test",
      include: ["src/**/*.ts"],
      exclude: ["node_modules/**"],
      docsDir: "docs",
      outputDir: "docs-output",
      repositoryUrl: "https://github.com/test/repo",
      maxConcurrency: 5,
      dryRun: false,
    };
    return config as unknown as ResolvedConfig;
  };

  it("should create OpenAI provider when provider is 'openai'", () => {
    const config = createMockConfig("openai");
    const provider = createLlmProvider(config);
    expect(provider).toBeDefined();
    expect(provider).toHaveProperty("chat");
    expect(provider).toHaveProperty("embed");
  });

  it("should create Ollama provider when provider is 'ollama'", () => {
    const config = createMockConfig("ollama");
    const provider = createLlmProvider(config);
    expect(provider).toBeDefined();
    expect(provider).toHaveProperty("chat");
    expect(provider).toHaveProperty("embed");
  });

  it("should create Gemini provider when provider is 'gemini'", () => {
    const config = createMockConfig("gemini");
    const provider = createLlmProvider(config);
    expect(provider).toBeDefined();
    expect(provider).toHaveProperty("chat");
    expect(provider).toHaveProperty("embed");
  });

  it("should create Claude provider when provider is 'claude'", () => {
    const config = createMockConfig("claude");
    const provider = createLlmProvider(config);
    expect(provider).toBeDefined();
    expect(provider).toHaveProperty("chat");
    expect(provider).toHaveProperty("embed");
  });

  it("should default to OpenAI provider for unknown provider", () => {
    const config = createMockConfig("unknown" as ProviderType);
    const provider = createLlmProvider(config);
    expect(provider).toBeDefined();
    expect(provider).toHaveProperty("chat");
    expect(provider).toHaveProperty("embed");
  });
});
