import { jest } from "@jest/globals";

// Mock OpenAI
const mockEmbeddingsCreate = jest
  .fn<(texts: string[]) => Promise<number[][]>>()
  .mockResolvedValue([[0.1, 0.2, 0.3]]);

// Mock Anthropic
const mockAnthropicCreate = jest.fn();
// @ts-expect-error Mocking Anthropic response
mockAnthropicCreate.mockResolvedValue({
  content: [{ type: "text", text: "Updated content from LLM" }],
});

jest.mock("@anthropic-ai/sdk", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: mockAnthropicCreate,
      },
    })),
  };
});

// Mock the provider factory
const mockCreateLlmProvider = jest.fn();
jest.mock("../src/llm/provider.js", () => ({
  createLlmProvider: mockCreateLlmProvider,
}));

import {
  parseFrontmatter,
  serializeFrontmatter,
  updateFrontmatter,
} from "../src/docs/frontmatter.js";
import Database from "better-sqlite3";
import { createDocRegistry } from "../src/docs/docRegistry.js";
import {
  createDocUpdater,
  parseSections,
  removeSection,
  updateSection,
} from "../src/docs/docUpdater.js";
import { ChangeImpact } from "../src/indexer/symbol.types.js";
import { mkdtemp, writeFile, mkdir, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Config, ConfigSchema } from "../src/config.js";
import { createCodeExampleValidator } from "../src/docs/codeExampleValidator.js";

describe("frontmatter parser", () => {
  const fixture1 = `---
title: User Service
symbols:
  - UserService
  - UserService.findById
lastUpdated: "2025-01-15"
---

# User Service

Manages user CRUD operations.`;

  const fixture2 = `# No Frontmatter

Just plain markdown content.`;

  const fixture3 = `---
title: Empty Symbols
---

# Empty Symbols`;

  const fixture4 = `---
title: Extra Fields
symbols:
  - Foo
custom: bar
tags:
  - api
  - v2
---

Content here.`;

  const fixture5 = `---
symbols:
  - OrderService
  - OrderService.createOrder
  - OrderService.cancelOrder
---
`;

  test("parses valid frontmatter with symbols", () => {
    const result = parseFrontmatter(fixture1);
    expect(result.frontmatter.title).toBe("User Service");
    expect(result.frontmatter.symbols).toEqual(["UserService", "UserService.findById"]);
    expect(result.frontmatter.lastUpdated).toBe("2025-01-15");
    expect(result.content).toContain("# User Service");
  });

  test("returns empty symbols for files without frontmatter", () => {
    const result = parseFrontmatter(fixture2);
    expect(result.frontmatter.symbols).toEqual([]);
    expect(result.content).toBe(fixture2);
  });

  test("returns empty symbols when symbols field is missing", () => {
    const result = parseFrontmatter(fixture3);
    expect(result.frontmatter.symbols).toEqual([]);
    expect(result.frontmatter.title).toBe("Empty Symbols");
  });

  test("preserves extra fields", () => {
    const result = parseFrontmatter(fixture4);
    expect(result.frontmatter.symbols).toEqual(["Foo"]);
    expect(result.frontmatter.custom).toBe("bar");
    expect(result.frontmatter.tags).toEqual(["api", "v2"]);
  });

  test("handles frontmatter with only symbols", () => {
    const result = parseFrontmatter(fixture5);
    expect(result.frontmatter.symbols).toEqual([
      "OrderService",
      "OrderService.createOrder",
      "OrderService.cancelOrder",
    ]);
  });

  test("serializeFrontmatter round-trips without data loss", () => {
    const parsed = parseFrontmatter(fixture1);
    const serialized = serializeFrontmatter(parsed);
    const reparsed = parseFrontmatter(serialized);
    expect(reparsed.frontmatter).toEqual(parsed.frontmatter);
    expect(reparsed.content).toEqual(parsed.content);
  });

  test("updateFrontmatter modifies only specified fields", () => {
    const updated = updateFrontmatter(fixture1, { lastUpdated: "2025-06-01" });
    const parsed = parseFrontmatter(updated);
    expect(parsed.frontmatter.lastUpdated).toBe("2025-06-01");
    expect(parsed.frontmatter.title).toBe("User Service");
    expect(parsed.frontmatter.symbols).toEqual(["UserService", "UserService.findById"]);
    expect(parsed.content).toContain("# User Service");
  });

  test("updateFrontmatter adds new fields", () => {
    const updated = updateFrontmatter(fixture2, {
      symbols: ["NewSymbol"],
      title: "New Doc",
    });
    const parsed = parseFrontmatter(updated);
    expect(parsed.frontmatter.symbols).toEqual(["NewSymbol"]);
    expect(parsed.frontmatter.title).toBe("New Doc");
  });

  test("handles empty frontmatter block", () => {
    const md = `---

---

Content after empty frontmatter.`;
    const result = parseFrontmatter(md);
    expect(result.frontmatter.symbols).toEqual([]);
    expect(result.content).toContain("Content after empty frontmatter.");
  });
});

describe("doc registry", () => {
  let db: Database.Database;
  let tmpDir: string;

  beforeEach(async () => {
    db = new Database(":memory:");
    tmpDir = await mkdtemp(join(tmpdir(), "dockit-test-"));

    await mkdir(join(tmpDir, "domain"), { recursive: true });

    await writeFile(
      join(tmpDir, "domain", "orders.md"),
      `---
title: Order Service
symbols:
  - OrderService
  - OrderService.createOrder
  - OrderService.cancelOrder
---

# Order Service

Content here.`,
    );

    await writeFile(
      join(tmpDir, "domain", "users.md"),
      `---
title: User Service
symbols:
  - UserService
  - UserService.findById
---

# User Service`,
    );

    await writeFile(join(tmpDir, "no-frontmatter.md"), `# Plain Doc\n\nNo frontmatter here.`);
  });

  afterEach(async () => {
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("rebuild populates registry from frontmatter", async () => {
    const registry = createDocRegistry(db);
    await registry.rebuild(tmpDir);

    const docs = await registry.findDocBySymbol("OrderService");
    expect(docs).toEqual([{ symbolName: "OrderService", docPath: "domain/orders.md" }]);
  });

  test("findDocBySymbol returns correct mappings", async () => {
    const registry = createDocRegistry(db);
    await registry.rebuild(tmpDir);

    const docs = await registry.findDocBySymbol("UserService.findById");
    expect(docs).toHaveLength(1);
    expect(docs[0].docPath).toBe("domain/users.md");
  });

  test("findSymbolsByDoc returns all symbols for a file", async () => {
    const registry = createDocRegistry(db);
    await registry.rebuild(tmpDir);

    const symbols = await registry.findSymbolsByDoc("domain/orders.md");
    expect(symbols.sort()).toEqual([
      "OrderService",
      "OrderService.cancelOrder",
      "OrderService.createOrder",
    ]);
  });

  test("skips docs without frontmatter", async () => {
    const registry = createDocRegistry(db);
    await registry.rebuild(tmpDir);

    const symbols = await registry.findSymbolsByDoc("no-frontmatter.md");
    expect(symbols).toEqual([]);
  });

  test("register adds a new mapping", async () => {
    const registry = createDocRegistry(db);
    await registry.register({
      symbolName: "PaymentService",
      docPath: "domain/payments.md",
    });

    const docs = await registry.findDocBySymbol("PaymentService");
    expect(docs).toHaveLength(1);
    expect(docs[0].docPath).toBe("domain/payments.md");
  });

  test("unregister removes mappings for a symbol", async () => {
    const registry = createDocRegistry(db);
    await registry.rebuild(tmpDir);

    await registry.unregister("OrderService");
    const docs = await registry.findDocBySymbol("OrderService");
    expect(docs).toEqual([]);
  });

  test("findDocBySymbol returns empty for unknown symbol", async () => {
    const registry = createDocRegistry(db);
    const docs = await registry.findDocBySymbol("NonExistent");
    expect(docs).toEqual([]);
  });
});

/* ====================== parseSections ====================== */

describe("parseSections", () => {
  test("parses headings at different levels", () => {
    const md = `# Title\n\nIntro text.\n\n## Section A\n\nContent A.\n\n## Section B\n\nContent B.\n\n### Sub B1\n\nSub content.`;
    const sections = parseSections(md);
    expect(sections).toHaveLength(4);
    expect(sections[0].heading).toBe("Title");
    expect(sections[0].level).toBe(1);
    expect(sections[1].heading).toBe("Section A");
    expect(sections[1].level).toBe(2);
    expect(sections[3].heading).toBe("Sub B1");
    expect(sections[3].level).toBe(3);
  });

  test("section endLine covers until next heading", () => {
    const md = `## A\n\nline1\nline2\n\n## B\n\nline3`;
    const sections = parseSections(md);
    expect(sections[0].startLine).toBe(0);
    expect(sections[0].endLine).toBe(4);
    expect(sections[1].startLine).toBe(5);
  });

  test("returns empty array for markdown without headings", () => {
    expect(parseSections("just text\nno headings")).toEqual([]);
  });
});

/* ====================== removeSection ====================== */

describe("removeSection", () => {
  const md = `# Orders\n\n## createOrder\n\nCreates an order.\n\n## cancelOrder\n\nCancels an order.\n`;

  test("removes the matching section", () => {
    const sections = parseSections(md);
    const { result } = removeSection(md, sections, "createOrder");
    expect(result).toContain("# Orders");
    expect(result).toContain("## cancelOrder");
    expect(result).not.toContain("createOrder");
  });

  test("returns unchanged markdown when section not found", () => {
    const sections = parseSections(md);
    const { result } = removeSection(md, sections, "nonExistent");
    expect(result).toBe(md);
  });
});

/* ====================== updateSection ====================== */

describe("updateSection", () => {
  const md = `# Orders\n\n## createOrder\n\nCreates an order.\n\n## cancelOrder\n\nCancels an order.\n`;

  const impact = {
    symbol: {
      id: "x",
      name: "createOrder",
      kind: "function",
      file: "f.ts",
      startLine: 0,
      endLine: 5,
    },
    changeType: "modified",
    diff: "",
    docUpdateRequired: true,
  } as unknown as ChangeImpact;

  const mockConfig = ConfigSchema.parse({
    projectRoot: "/tmp",
    llm: {
      provider: "openai",
      apiKey: "test-key",
    },
  });

  test("updates existing section content", async () => {
    const sections = parseSections(md);
    const mockProvider = {
      chat: async () => "Updated content from LLM",
      embed: mockEmbeddingsCreate,
    };
    const { result, heading } = await updateSection(
      md,
      sections,
      "createOrder",
      impact,
      mockConfig,
      mockProvider,
    );
    expect(result).toContain("## createOrder");
    expect(result).toContain("Updated content from LLM");
    expect(result).toContain("## cancelOrder");
    expect(heading).toBe("createOrder");
  });

  test("appends new section when not found", async () => {
    const sections = parseSections(md);
    const newImpact = {
      ...impact,
      symbol: { ...impact.symbol, name: "processOrder" },
      changeType: "added",
    } as unknown as ChangeImpact;
    const mockProvider = {
      chat: async () => "Updated content from LLM",
      embed: mockEmbeddingsCreate,
    };
    const { result } = await updateSection(
      md,
      sections,
      "processOrder",
      newImpact,
      mockConfig,
      mockProvider,
    );
    expect(result).toContain("## processOrder");
    expect(result).toContain("TODO: Document");
  });
});

/* ====================== docUpdater integration ====================== */

describe("docUpdater", () => {
  let db: Database.Database;
  let tmpDir: string;
  let mockConfig: Config;
  let updater: ReturnType<typeof createDocUpdater>;

  const ordersDoc = `---
title: Order Service
symbols:
  - OrderService
  - createOrder
  - legacyMethod
---

# Order Service

## createOrder

Creates a new order in the system.

## legacyMethod

Old deprecated method.
`;

  beforeEach(async () => {
    // Create mock provider
    const mockProvider = {
      chat: async () => "Updated content from LLM",
      embed: mockEmbeddingsCreate,
    };

    db = new Database(":memory:");
    tmpDir = await mkdtemp(join(tmpdir(), "dockit-updater-"));
    await mkdir(join(tmpDir, "domain"), { recursive: true });
    await writeFile(join(tmpDir, "domain", "orders.md"), ordersDoc);
    mockConfig = ConfigSchema.parse({
      projectRoot: tmpDir,
      llm: {
        provider: "openai",
        apiKey: "test-key",
      },
    });

    // Create updater with mock provider
    updater = createDocUpdater({ llm: mockProvider });
  });

  afterEach(async () => {
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  function makeImpact(name: string, changeType: string): ChangeImpact {
    return {
      symbol: { id: "t", name, kind: "function", file: "src/test.ts", startLine: 0, endLine: 5 },
      changeType,
      diff: "some diff",
      docUpdateRequired: true,
    } as unknown as ChangeImpact;
  }

  test("updates correct section for modified symbol", async () => {
    const registry = createDocRegistry(db);
    await registry.rebuild(tmpDir);
    const results = await updater.applyChanges(
      [makeImpact("createOrder", "modified")],
      registry,
      tmpDir,
      mockConfig,
    );

    expect(results).toHaveLength(1);
    expect(results[0].action).toBe("updated");
    expect(results[0].symbolName).toBe("createOrder");
    expect(results[0].sectionHeading).toBe("## createOrder");

    const content = await readFile(join(tmpDir, "domain", "orders.md"), "utf-8");
    expect(content).toContain("Updated content from LLM");
    expect(content).toContain("## legacyMethod");
  });

  test("removes correct section for deleted symbol", async () => {
    const registry = createDocRegistry(db);
    await registry.rebuild(tmpDir);
    const results = await updater.applyChanges(
      [makeImpact("legacyMethod", "removed")],
      registry,
      tmpDir,
      mockConfig,
    );

    expect(results).toHaveLength(1);
    expect(results[0].action).toBe("removed");

    const content = await readFile(join(tmpDir, "domain", "orders.md"), "utf-8");
    expect(content).not.toContain("## legacyMethod");
    expect(content).not.toContain("Old deprecated method.");
    expect(content).toContain("## createOrder");
  });

  test("never creates new files", async () => {
    const registry = createDocRegistry(db);
    const results = await updater.applyChanges(
      [makeImpact("BrandNew", "added")],
      registry,
      tmpDir,
      mockConfig,
    );
    expect(results).toHaveLength(1);
    expect(results[0].action).toBe("skipped");
  });

  test("does not modify unrelated sections", async () => {
    const registry = createDocRegistry(db);
    await registry.rebuild(tmpDir);
    await updater.applyChanges(
      [makeImpact("createOrder", "modified")],
      registry,
      tmpDir,
      mockConfig,
    );

    const content = await readFile(join(tmpDir, "domain", "orders.md"), "utf-8");
    expect(content).toContain("## legacyMethod");
    expect(content).toContain("Old deprecated method.");
  });

  test("dryRun returns diff without writing", async () => {
    const registry = createDocRegistry(db);
    await registry.rebuild(tmpDir);
    const dryRunUpdater = createDocUpdater({
      dryRun: true,
      llm: { chat: async () => "Updated content from LLM", embed: mockEmbeddingsCreate },
    });
    const results = await dryRunUpdater.applyChanges(
      [makeImpact("createOrder", "modified")],
      registry,
      tmpDir,
      mockConfig,
    );

    expect(results[0].diff).toBeDefined();
    expect(results[0].diff!.length).toBeGreaterThan(0);

    // File should be unchanged
    const content = await readFile(join(tmpDir, "domain", "orders.md"), "utf-8");
    expect(content).toBe(ordersDoc);
  });

  test("skips impacts where docUpdateRequired is false", async () => {
    const registry = createDocRegistry(db);
    await registry.rebuild(tmpDir);
    const impact = makeImpact("createOrder", "modified");
    impact.docUpdateRequired = false;
    const results = await updater.applyChanges([impact], registry, tmpDir, mockConfig);
    expect(results).toHaveLength(0);
  });

  test("returns skipped for symbol with no doc mapping", async () => {
    const registry = createDocRegistry(db);
    await registry.rebuild(tmpDir);
    const results = await updater.applyChanges(
      [makeImpact("UnknownSymbol", "modified")],
      registry,
      tmpDir,
      mockConfig,
    );
    expect(results).toHaveLength(1);
    expect(results[0].action).toBe("skipped");
  });
});

describe("CodeExampleValidator", () => {
  describe("extractExamples", () => {
    it("extracts code blocks from markdown", async () => {
      const validator = createCodeExampleValidator();
      const tmpDir = await mkdtemp(join(tmpdir(), "doc-test-"));
      const docPath = join(tmpDir, "test.md");

      const content = `# Test Document

Some text here.

\`\`\`typescript
const x: number = 42;
console.log(x);
\`\`\`

More text.

\`\`\`bash
echo "Hello World"
\`\`\`
`;

      await writeFile(docPath, content);

      const examples = await validator.extractExamples(docPath);

      expect(examples).toHaveLength(2);
      expect(examples[0].language).toBe("typescript");
      expect(examples[0].code).toContain("const x: number = 42;");
      expect(examples[1].language).toBe("bash");
      expect(examples[1].code).toContain('echo "Hello World"');

      await rm(tmpDir, { recursive: true });
    });
  });

  describe("validateExample", () => {
    it("validates TypeScript code", async () => {
      const validator = createCodeExampleValidator();

      const example = {
        language: "typescript",
        code: "const x: number = 42; console.log(x);",
        lineStart: 1,
        lineEnd: 1,
      };

      const result = await validator.validateExample(example);

      expect(result.valid).toBe(true);
      expect(result.example).toBe(example);
    });

    it("validates JavaScript code", async () => {
      const validator = createCodeExampleValidator();

      const example = {
        language: "javascript",
        code: "const x = 42; console.log(x);",
        lineStart: 1,
        lineEnd: 1,
      };

      const result = await validator.validateExample(example);

      expect(result.valid).toBe(true);
      expect(result.example).toBe(example);
    });

    it("validates Bash code", async () => {
      const validator = createCodeExampleValidator();

      const example = {
        language: "bash",
        code: 'echo "Hello World"',
        lineStart: 1,
        lineEnd: 1,
      };

      const result = await validator.validateExample(example);

      expect(result.valid).toBe(true);
      expect(result.example).toBe(example);
    });

    it("rejects invalid TypeScript", async () => {
      const validator = createCodeExampleValidator();

      const example = {
        language: "typescript",
        code: "const x: number = 'invalid';",
        lineStart: 1,
        lineEnd: 1,
      };

      const result = await validator.validateExample(example);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("TypeScript compilation error");
    });

    it("handles unknown languages", async () => {
      const validator = createCodeExampleValidator();

      const example = {
        language: "unknown",
        code: "some code here",
        lineStart: 1,
        lineEnd: 1,
      };

      const result = await validator.validateExample(example);

      expect(result.valid).toBe(true); // Accepts unknown languages if not empty
    });

    it("validates PHP code", async () => {
      const validator = createCodeExampleValidator();

      const example = {
        language: "php",
        code: "<?php\necho 'Hello World';\n?>",
        lineStart: 1,
        lineEnd: 1,
      };

      const result = await validator.validateExample(example);

      expect(result.valid).toBe(true);
      expect(result.example).toBe(example);
    });

    it("validates Dart code", async () => {
      const validator = createCodeExampleValidator();

      const example = {
        language: "dart",
        code: "void main() {\n  print('Hello World');\n}",
        lineStart: 1,
        lineEnd: 1,
      };

      const result = await validator.validateExample(example);

      expect(result.valid).toBe(true);
      expect(result.example).toBe(example);
    });

    it("validates Flutter code", async () => {
      const validator = createCodeExampleValidator();

      const example = {
        language: "flutter",
        code: "void main() {\n  print('Hello Flutter');\n}",
        lineStart: 1,
        lineEnd: 1,
      };

      const result = await validator.validateExample(example);

      expect(result.valid).toBe(true);
      expect(result.example).toBe(example);
    });

    it("validates Python code", async () => {
      const validator = createCodeExampleValidator();

      const example = {
        language: "python",
        code: "print('Hello World')",
        lineStart: 1,
        lineEnd: 1,
      };

      const result = await validator.validateExample(example);

      expect(result.valid).toBe(true);
      expect(result.example).toBe(example);
    });

    it("validates Go code", async () => {
      const validator = createCodeExampleValidator();

      const example = {
        language: "go",
        code: 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello World")\n}',
        lineStart: 1,
        lineEnd: 1,
      };

      const result = await validator.validateExample(example);

      expect(result.valid).toBe(true);
      expect(result.example).toBe(example);
    });

    it("validates Rust code", async () => {
      const validator = createCodeExampleValidator();

      const example = {
        language: "rust",
        code: 'fn main() {\n    println!("Hello World");\n}',
        lineStart: 1,
        lineEnd: 1,
      };

      const result = await validator.validateExample(example);

      expect(result.valid).toBe(true);
      expect(result.example).toBe(example);
    });
  });
});
