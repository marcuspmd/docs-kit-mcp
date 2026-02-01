import { ConfigSchema, resolvePrompts, minimatch, type Config } from "../src/config.js";

describe("ConfigSchema", () => {
  it("should parse minimal config with defaults", () => {
    const config = ConfigSchema.parse({ projectRoot: "/tmp/test" });

    expect(config.projectRoot).toBe("/tmp/test");
    expect(config.respectGitignore).toBe(true);
    expect(config.maxFileSize).toBe(512_000);
    expect(config.include).toContain("**/*.ts");
    expect(config.exclude).toContain("**/node_modules/**");
    expect(config.promptRules).toEqual([]);
    expect(config.defaultPrompts.symbolPrompt).toBeDefined();
  });

  it("should reject promptRule without language or pattern", () => {
    expect(() =>
      ConfigSchema.parse({
        projectRoot: "/tmp",
        promptRules: [{ name: "bad rule" }],
      }),
    ).toThrow();
  });

  it("should parse full config with all options", () => {
    const config = ConfigSchema.parse({
      projectRoot: "/tmp/test",
      include: ["**/*.ts"],
      exclude: ["**/node_modules/**"],
      respectGitignore: false,
      maxFileSize: 1000000,
      dbPath: "custom.db",
      promptRules: [
        {
          name: "typescript",
          language: "typescript",
          symbolPrompt: "Custom symbol prompt",
          docPrompt: "Custom doc prompt",
          changePrompt: "Custom change prompt",
        },
      ],
      defaultPrompts: {
        symbolPrompt: "Default symbol",
        docPrompt: "Default doc",
        changePrompt: "Default change",
      },
      llm: {
        provider: "claude",
        apiKey: "test-key",
        model: "claude-3",
        embeddingModel: "claude-embed",
        baseUrl: "https://api.anthropic.com",
        maxTokens: 4000,
        temperature: 0.5,
      },
    });

    expect(config.projectRoot).toBe("/tmp/test");
    expect(config.include).toEqual(["**/*.ts"]);
    expect(config.exclude).toEqual(["**/node_modules/**"]);
    expect(config.respectGitignore).toBe(false);
    expect(config.maxFileSize).toBe(1000000);
    expect(config.dbPath).toBe("custom.db");
    expect(config.promptRules).toHaveLength(1);
    expect(config.llm.provider).toBe("claude");
    expect(config.llm.apiKey).toBe("test-key");
  });

  it("should use default LLM config", () => {
    const config = ConfigSchema.parse({ projectRoot: "/tmp/test" });

    expect(config.llm.provider).toBe("openai");
    expect(config.llm.model).toBe("gpt-4");
    expect(config.llm.maxTokens).toBe(2000);
    expect(config.llm.temperature).toBe(0.7);
  });
});

describe("resolvePrompts", () => {
  const baseConfig: Config = {
    projectRoot: "/tmp",
    include: [],
    exclude: [],
    respectGitignore: true,
    maxFileSize: 512000,
    dbPath: ".doc-kit/index.db",
    promptRules: [
      {
        name: "typescript",
        language: "typescript",
        symbolPrompt: "TypeScript symbol prompt",
        docPrompt: "TypeScript doc prompt",
      },
      {
        name: "pattern-rule",
        pattern: "**/*.test.ts",
        changePrompt: "Test change prompt",
      },
    ],
    docs: [],
    defaultPrompts: {
      symbolPrompt: "Default symbol",
      docPrompt: "Default doc",
      changePrompt: "Default change",
    },
    llm: {
      provider: "openai",
      model: "gpt-4",
      maxTokens: 2000,
      temperature: 0.7,
    },
  };

  it("should return default prompts when no rules match", () => {
    const result = resolvePrompts(baseConfig, { path: "src/file.js" });

    expect(result.symbolPrompt).toBe("Default symbol");
    expect(result.docPrompt).toBe("Default doc");
    expect(result.changePrompt).toBe("Default change");
  });

  it("should match by language", () => {
    const result = resolvePrompts(baseConfig, {
      language: "typescript",
      path: "src/file.ts",
    });

    expect(result.symbolPrompt).toBe("TypeScript symbol prompt");
    expect(result.docPrompt).toBe("TypeScript doc prompt");
    expect(result.changePrompt).toBe("Default change");
  });

  it("should match by pattern", () => {
    const result = resolvePrompts(baseConfig, {
      path: "src/file.test.ts",
    });

    expect(result.symbolPrompt).toBe("Default symbol");
    expect(result.docPrompt).toBe("Default doc");
    expect(result.changePrompt).toBe("Test change prompt");
  });

  it("should match first rule that applies", () => {
    const configWithMultipleRules: Config = {
      ...baseConfig,
      promptRules: [
        {
          name: "first",
          language: "typescript",
          symbolPrompt: "First prompt",
        },
        {
          name: "second",
          language: "typescript",
          symbolPrompt: "Second prompt",
        },
      ],
    };

    const result = resolvePrompts(configWithMultipleRules, {
      language: "typescript",
      path: "src/file.ts",
    });

    expect(result.symbolPrompt).toBe("First prompt");
  });

  it("should handle missing language in file", () => {
    const result = resolvePrompts(baseConfig, { path: "src/file.ts" });

    expect(result.symbolPrompt).toBe("Default symbol");
  });
});

describe("minimatch", () => {
  it("should match exact strings", () => {
    expect(minimatch("file.ts", "file.ts")).toBe(true);
  });

  it("should match single wildcard", () => {
    expect(minimatch("file.ts", "*.ts")).toBe(true);
    expect(minimatch("file.js", "*.ts")).toBe(false);
  });

  it("should match double wildcard", () => {
    expect(minimatch("src/file.ts", "**/*.ts")).toBe(true);
    expect(minimatch("src/nested/file.ts", "**/*.ts")).toBe(true);
    expect(minimatch("file.js", "**/*.ts")).toBe(false);
  });

  it("should escape dots", () => {
    expect(minimatch("file.ts", "file.ts")).toBe(true);
    expect(minimatch("file.ts", "file\\*ts")).toBe(false);
  });

  it("should handle complex patterns", () => {
    expect(minimatch("src/test/file.test.ts", "**/*.test.ts")).toBe(true);
    expect(minimatch("src/main/file.ts", "**/*.test.ts")).toBe(false);
  });
});
