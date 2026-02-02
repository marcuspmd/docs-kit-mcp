import { ConfigSchema, resolvePrompts, minimatch, type Config } from "../src/config.js";
import { expandAutoDiscoveryDocs, linkDocNavigation } from "../src/docs/autoDiscovery.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

    expect(config.llm.provider).toBe("none");
    expect(config.llm.model).toBe("gpt-4");
    expect(config.llm.maxTokens).toBe(2000);
    expect(config.llm.temperature).toBe(0.7);
  });

  it("should parse archGuard configuration", () => {
    const config = ConfigSchema.parse({
      projectRoot: "/tmp/test",
      archGuard: {
        rules: [
          {
            name: "max-complexity",
            type: "max_complexity",
            severity: "warning",
            config: { threshold: 10 },
          },
          {
            name: "naming-convention",
            type: "naming_convention",
            severity: "error",
            config: { pattern: "^[A-Z]", kinds: ["class"] },
          },
        ],
      },
    });

    expect(config.archGuard).toBeDefined();
    expect(config.archGuard?.rules).toHaveLength(2);
    expect(config.archGuard?.rules[0].name).toBe("max-complexity");
    expect(config.archGuard?.rules[0].type).toBe("max_complexity");
    expect(config.archGuard?.rules[0].severity).toBe("warning");
    expect(config.archGuard?.rules[1].type).toBe("naming_convention");
  });

  it("should accept all archGuard rule types", () => {
    const ruleTypes = [
      "layer_boundary",
      "forbidden_import",
      "naming_convention",
      "max_complexity",
      "max_parameters",
      "max_lines",
      "missing_return_type",
    ];

    ruleTypes.forEach((type) => {
      const config = ConfigSchema.parse({
        projectRoot: "/tmp/test",
        archGuard: {
          rules: [
            {
              name: `test-${type}`,
              type,
              config: {},
            },
          ],
        },
      });

      expect(config.archGuard?.rules[0].type).toBe(type);
    });
  });

  it("should reject invalid archGuard rule types", () => {
    expect(() =>
      ConfigSchema.parse({
        projectRoot: "/tmp/test",
        archGuard: {
          rules: [
            {
              name: "invalid-rule",
              type: "invalid_type",
              config: {},
            },
          ],
        },
      }),
    ).toThrow();
  });

  it("should make archGuard optional", () => {
    const config = ConfigSchema.parse({ projectRoot: "/tmp/test" });

    expect(config.archGuard).toBeUndefined();
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

describe("expandAutoDiscoveryDocs", () => {
  const testRoot = path.resolve(__dirname, "fixtures/docs-autodiscovery");

  beforeAll(() => {
    // Create test directory structure
    fs.mkdirSync(testRoot, { recursive: true });
    fs.mkdirSync(path.join(testRoot, "examples"), { recursive: true });
    fs.mkdirSync(path.join(testRoot, "examples/basic"), { recursive: true });
    fs.mkdirSync(path.join(testRoot, "examples/advanced"), { recursive: true });

    // Create test markdown files
    fs.writeFileSync(
      path.join(testRoot, "examples/basic/getting-started.md"),
      "# Getting Started\n",
    );
    fs.writeFileSync(path.join(testRoot, "examples/basic/installation.md"), "# Installation\n");
    fs.writeFileSync(path.join(testRoot, "examples/advanced/deployment.md"), "# Deployment\n");
    fs.writeFileSync(path.join(testRoot, "examples/advanced/scaling.md"), "# Scaling\n");
  });

  afterAll(() => {
    // Clean up test directory
    if (fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
  });

  it("should expand autoDiscovery entries into multiple docs", async () => {
    const docs = [
      {
        path: "./fixtures/docs-autodiscovery/examples",
        autoDiscovery: true,
      },
    ];

    const expanded = await expandAutoDiscoveryDocs(docs, __dirname);

    // Should find 4 markdown files
    expect(expanded.length).toBe(4);

    // Check that all files were discovered
    // Note: path.join normalizes paths, removing leading ./
    const paths = expanded.map((d) => d.path);
    expect(paths).toContain("fixtures/docs-autodiscovery/examples/basic/getting-started.md");
    expect(paths).toContain("fixtures/docs-autodiscovery/examples/basic/installation.md");
    expect(paths).toContain("fixtures/docs-autodiscovery/examples/advanced/deployment.md");
    expect(paths).toContain("fixtures/docs-autodiscovery/examples/advanced/scaling.md");
  });

  it("should generate module names from directory structure", async () => {
    const docs = [
      {
        path: "./fixtures/docs-autodiscovery/examples",
        autoDiscovery: true,
      },
    ];

    const expanded = await expandAutoDiscoveryDocs(docs, __dirname);

    const basicDoc = expanded.find((d) => d.path.includes("getting-started"));
    expect(basicDoc?.module).toBe("examples/basic");

    const advancedDoc = expanded.find((d) => d.path.includes("deployment"));
    expect(advancedDoc?.module).toBe("examples/advanced");
  });

  it("should generate category from immediate parent directory", async () => {
    const docs = [
      {
        path: "./fixtures/docs-autodiscovery/examples",
        autoDiscovery: true,
      },
    ];

    const expanded = await expandAutoDiscoveryDocs(docs, __dirname);

    const basicDoc = expanded.find((d) => d.path.includes("getting-started"));
    expect(basicDoc?.category).toBe("basic");

    const advancedDoc = expanded.find((d) => d.path.includes("deployment"));
    expect(advancedDoc?.category).toBe("advanced");
  });

  it("should generate name and title from filename", async () => {
    const docs = [
      {
        path: "./fixtures/docs-autodiscovery/examples",
        autoDiscovery: true,
      },
    ];

    const expanded = await expandAutoDiscoveryDocs(docs, __dirname);

    const doc = expanded.find((d) => d.path.includes("getting-started"));
    expect(doc?.name).toBe("getting-started");
    expect(doc?.title).toBe("Getting Started");
  });

  it("should auto-generate next/previous links", async () => {
    const docs = [
      {
        path: "./fixtures/docs-autodiscovery/examples",
        autoDiscovery: true,
      },
    ];

    const expanded = await expandAutoDiscoveryDocs(docs, __dirname);
    const linked = linkDocNavigation(expanded);

    // Files are sorted alphabetically within auto-discovery
    expect(linked[0].previous).toBeUndefined();
    expect(linked[0].next).toBe(linked[1].path);

    expect(linked[1].previous).toBe(linked[0].path);
    expect(linked[1].next).toBe(linked[2].path);

    expect(linked[linked.length - 1].previous).toBe(linked[linked.length - 2].path);
    expect(linked[linked.length - 1].next).toBeUndefined();
  });

  it("should preserve non-autoDiscovery entries", async () => {
    const docs = [
      {
        path: "./docs/manual-doc.md",
        title: "Manual Doc",
        name: "manual-doc",
        category: "manual",
        module: "Main",
      },
      {
        path: "./fixtures/docs-autodiscovery/examples",
        autoDiscovery: true,
      },
    ];

    const expanded = await expandAutoDiscoveryDocs(docs, __dirname);

    // Should have manual doc + 4 discovered docs
    expect(expanded.length).toBe(5);

    const manualDoc = expanded.find((d) => d.path === "./docs/manual-doc.md");
    expect(manualDoc?.title).toBe("Manual Doc");
    expect(manualDoc?.module).toBe("Main");
  });

  it("should skip non-existent directories", async () => {
    const docs = [
      {
        path: "./non-existent-directory",
        autoDiscovery: true,
      },
    ];

    const expanded = await expandAutoDiscoveryDocs(docs, __dirname);

    // Should keep the entry as-is with warning
    expect(expanded.length).toBe(1);
    expect(expanded[0].path).toBe("./non-existent-directory");
  });
});

describe("linkDocNavigation", () => {
  it("should link docs sequentially in array order", () => {
    const docs = [
      { path: "docs/a.md", module: "Main", name: "a", title: "A", category: "docs" },
      { path: "docs/b.md", module: "Main", name: "b", title: "B", category: "docs" },
      { path: "docs/c.md", module: "Main", name: "c", title: "C", category: "docs" },
    ];

    const linked = linkDocNavigation(docs);

    expect(linked[0].previous).toBeUndefined();
    expect(linked[0].next).toBe("docs/b.md");

    expect(linked[1].previous).toBe("docs/a.md");
    expect(linked[1].next).toBe("docs/c.md");

    expect(linked[2].previous).toBe("docs/b.md");
    expect(linked[2].next).toBeUndefined();
  });

  it("should respect explicit next/previous links", () => {
    const docs = [
      {
        path: "docs/a.md",
        module: "Main",
        name: "a",
        title: "A",
        category: "docs",
        next: "docs/c.md",
      },
      { path: "docs/b.md", module: "Main", name: "b", title: "B", category: "docs" },
      {
        path: "docs/c.md",
        module: "Main",
        name: "c",
        title: "C",
        category: "docs",
        previous: "docs/a.md",
      },
    ];

    const linked = linkDocNavigation(docs);

    const aDoc = linked.find((d) => d.path === "docs/a.md");
    expect(aDoc?.next).toBe("docs/c.md"); // Explicit next is preserved

    const bDoc = linked.find((d) => d.path === "docs/b.md");
    expect(bDoc?.previous).toBe("docs/a.md"); // Auto-generated from array position
    expect(bDoc?.next).toBe("docs/c.md"); // Auto-generated from array position

    const cDoc = linked.find((d) => d.path === "docs/c.md");
    expect(cDoc?.previous).toBe("docs/a.md"); // Explicit previous is preserved
    expect(cDoc?.next).toBeUndefined();
  });

  it("should link across different modules in array order", () => {
    const docs = [
      { path: "docs/a.md", module: "Main", name: "a", title: "A", category: "docs" },
      { path: "examples/b.md", module: "Examples", name: "b", title: "B", category: "examples" },
      { path: "docs/c.md", module: "Main", name: "c", title: "C", category: "docs" },
    ];

    const linked = linkDocNavigation(docs);

    const aDoc = linked.find((d) => d.path === "docs/a.md");
    const bDoc = linked.find((d) => d.path === "examples/b.md");
    const cDoc = linked.find((d) => d.path === "docs/c.md");

    // All docs are linked sequentially regardless of module
    expect(aDoc?.next).toBe("examples/b.md");
    expect(bDoc?.previous).toBe("docs/a.md");
    expect(bDoc?.next).toBe("docs/c.md");
    expect(cDoc?.previous).toBe("examples/b.md");
  });
});
