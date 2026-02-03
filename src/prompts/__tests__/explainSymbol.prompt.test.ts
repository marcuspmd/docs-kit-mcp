import {
  buildExplainSymbolPrompt,
  buildExplainSymbolPromptForMcp,
} from "../explainSymbol.prompt.js";
import type { CodeSymbol } from "../../indexer/symbol.types.js";

describe("explainSymbol.prompt", () => {
  const createMockSymbol = (overrides?: Partial<CodeSymbol>): CodeSymbol => ({
    id: "test-id",
    name: "testFunction",
    qualifiedName: "module.testFunction",
    kind: "function",
    file: "/test/file.ts",
    startLine: 1,
    endLine: 10,
    signature: "(param: string): boolean",
    layer: "application",
    pattern: "factory",
    extends: undefined,
    implements: ["Interface1", "Interface2"],
    deprecated: false,
    ...overrides,
  });

  describe("buildExplainSymbolPrompt", () => {
    it("should build basic prompt with required fields", () => {
      const symbol = createMockSymbol({ extends: undefined, implements: [] });
      const prompt = buildExplainSymbolPrompt({ symbol });

      expect(prompt).toContain("## Symbol: module.testFunction");
      expect(prompt).toContain("- **Kind**: function");
      expect(prompt).toContain("- **File**: /test/file.ts:1-10");
      expect(prompt).toContain("## Instructions");
    });

    it("should include signature when present", () => {
      const symbol = createMockSymbol();
      const prompt = buildExplainSymbolPrompt({ symbol });

      expect(prompt).toContain("- **Signature**: `(param: string): boolean`");
    });

    it("should include layer when present", () => {
      const symbol = createMockSymbol();
      const prompt = buildExplainSymbolPrompt({ symbol });

      expect(prompt).toContain("- **Layer**: application");
    });

    it("should include pattern when present", () => {
      const symbol = createMockSymbol();
      const prompt = buildExplainSymbolPrompt({ symbol });

      expect(prompt).toContain("- **Pattern**: factory");
    });

    it("should include deprecated flag when true", () => {
      const symbol = createMockSymbol({ deprecated: true });
      const prompt = buildExplainSymbolPrompt({ symbol });

      expect(prompt).toContain("- **DEPRECATED**");
    });

    it("should include source code when provided", () => {
      const symbol = createMockSymbol();
      const sourceCode = "function test() { return true; }";
      const prompt = buildExplainSymbolPrompt({ symbol, sourceCode });

      expect(prompt).toContain("## Source Code");
      expect(prompt).toContain(sourceCode);
    });

    it("should include existing documentation when provided", () => {
      const symbol = createMockSymbol();
      const docContent = "# Test Documentation\nThis is a test";
      const prompt = buildExplainSymbolPrompt({ symbol, docContent });

      expect(prompt).toContain("## Existing Documentation");
      expect(prompt).toContain(docContent);
    });

    it("should include dependencies when provided", () => {
      const symbol = createMockSymbol();
      const dependencies = [
        createMockSymbol({ name: "dep1", kind: "class" as any }),
        createMockSymbol({ name: "dep2", kind: "function" as any }),
      ];
      const prompt = buildExplainSymbolPrompt({ symbol, dependencies });

      expect(prompt).toContain("## Dependencies (this symbol uses):");
      expect(prompt).toContain("- dep1 (class in /test/file.ts)");
      expect(prompt).toContain("- dep2 (function in /test/file.ts)");
    });

    it("should include dependents when provided", () => {
      const symbol = createMockSymbol();
      const dependents = [createMockSymbol({ name: "user1", kind: "function" as any })];
      const prompt = buildExplainSymbolPrompt({ symbol, dependents });

      expect(prompt).toContain("## Dependents (use this symbol):");
      expect(prompt).toContain("- user1 (function in /test/file.ts)");
    });

    it("should include implements when array is not empty", () => {
      const symbol = createMockSymbol({ implements: ["Interface1", "Interface2"] });
      const prompt = buildExplainSymbolPrompt({ symbol });

      expect(prompt).toContain("- **Implements**: Interface1, Interface2");
    });

    it("should include extends when present", () => {
      const symbol = createMockSymbol({ extends: "BaseClass" });
      const prompt = buildExplainSymbolPrompt({ symbol });

      expect(prompt).toContain("- **Extends**: BaseClass");
    });

    it("should handle all fields together", () => {
      const symbol = createMockSymbol({ extends: "BaseClass" });
      const sourceCode = "code here";
      const docContent = "docs here";
      const dependencies = [createMockSymbol({ name: "dep" })];
      const dependents = [createMockSymbol({ name: "user" })];

      const prompt = buildExplainSymbolPrompt({
        symbol,
        sourceCode,
        docContent,
        dependencies,
        dependents,
      });

      expect(prompt).toContain("## Symbol:");
      expect(prompt).toContain("## Source Code");
      expect(prompt).toContain("## Existing Documentation");
      expect(prompt).toContain("## Dependencies");
      expect(prompt).toContain("## Dependents");
      expect(prompt).toContain("## Instructions");
    });
  });

  describe("buildExplainSymbolPromptForMcp", () => {
    it("should build MCP prompt without cached explanation", () => {
      const symbol = createMockSymbol();
      const prompt = buildExplainSymbolPromptForMcp({ symbol });

      expect(prompt).toContain("## Symbol:");
      expect(prompt).toContain("updateSymbolExplanation");
      expect(prompt).toContain("cache your response");
      expect(prompt).not.toContain("## Cached Explanation");
    });

    it("should include cached explanation when provided", () => {
      const symbol = createMockSymbol();
      const cached = "This is the cached explanation";
      const prompt = buildExplainSymbolPromptForMcp({ symbol }, cached);

      expect(prompt).toContain("## Cached Explanation");
      expect(prompt).toContain(cached);
      expect(prompt).toContain("updateSymbolExplanation");
    });

    it("should include base prompt content", () => {
      const symbol = createMockSymbol();
      const prompt = buildExplainSymbolPromptForMcp({ symbol });

      const basePrompt = buildExplainSymbolPrompt({ symbol });
      expect(prompt).toContain(basePrompt);
    });
  });
});
