import { describe, it, expect, beforeEach } from "@jest/globals";
import { ParserRegistry } from "../ParserRegistry.js";
import type { ILanguageParser } from "../strategies/ILanguageParser.js";

describe("ParserRegistry", () => {
  let registry: ParserRegistry;

  // Mock parser implementation
  class MockParser implements ILanguageParser {
    readonly supportedExtensions: string[];

    constructor(extensions: string[]) {
      this.supportedExtensions = extensions;
    }

    async parse() {
      return {
        symbols: [],
        relationships: [],
        metadata: { language: "test", loc: 0, size: 0 },
      };
    }

    async validate() {
      return { isValid: true, errors: [] };
    }
  }

  beforeEach(() => {
    registry = new ParserRegistry();
  });

  describe("register", () => {
    it("should register a parser with name", () => {
      const parser = new MockParser([".ts"]);
      registry.register("typescript", parser);

      const retrieved = registry.getParser("typescript");
      expect(retrieved).toBe(parser);
    });

    it("should map extensions to parser", () => {
      const parser = new MockParser([".ts", ".tsx"]);
      registry.register("typescript", parser);

      expect(registry.getParserForFile("file.ts")).toBe(parser);
      expect(registry.getParserForFile("file.tsx")).toBe(parser);
    });

    it("should handle case-insensitive extensions", () => {
      const parser = new MockParser([".TS", ".TSX"]);
      registry.register("typescript", parser);

      expect(registry.getParserForFile("file.ts")).toBe(parser);
      expect(registry.getParserForFile("file.tsx")).toBe(parser);
      expect(registry.getParserForFile("file.TS")).toBe(parser);
      expect(registry.getParserForFile("file.TSX")).toBe(parser);
    });

    it("should overwrite previous parser with same name", () => {
      const parser1 = new MockParser([".ts"]);
      const parser2 = new MockParser([".ts"]);

      registry.register("typescript", parser1);
      registry.register("typescript", parser2);

      expect(registry.getParser("typescript")).toBe(parser2);
    });

    it("should register multiple parsers", () => {
      const tsParser = new MockParser([".ts", ".tsx"]);
      const jsParser = new MockParser([".js", ".jsx"]);

      registry.register("typescript", tsParser);
      registry.register("javascript", jsParser);

      expect(registry.getParser("typescript")).toBe(tsParser);
      expect(registry.getParser("javascript")).toBe(jsParser);
    });
  });

  describe("getParserForFile", () => {
    it("should return parser for supported file", () => {
      const parser = new MockParser([".ts"]);
      registry.register("typescript", parser);

      expect(registry.getParserForFile("src/index.ts")).toBe(parser);
    });

    it("should return null for unsupported file", () => {
      const parser = new MockParser([".ts"]);
      registry.register("typescript", parser);

      expect(registry.getParserForFile("src/index.py")).toBeNull();
    });

    it("should extract extension from full path", () => {
      const parser = new MockParser([".tsx"]);
      registry.register("react", parser);

      expect(registry.getParserForFile("/path/to/Component.tsx")).toBe(parser);
    });

    it("should handle files without extension", () => {
      const parser = new MockParser([".ts"]);
      registry.register("typescript", parser);

      expect(registry.getParserForFile("Dockerfile")).toBeNull();
    });
  });

  describe("getParser", () => {
    it("should return parser by name", () => {
      const parser = new MockParser([".ts"]);
      registry.register("typescript", parser);

      expect(registry.getParser("typescript")).toBe(parser);
    });

    it("should return null for non-existent name", () => {
      expect(registry.getParser("non-existent")).toBeNull();
    });

    it("should be case-sensitive for parser names", () => {
      const parser = new MockParser([".ts"]);
      registry.register("typescript", parser);

      expect(registry.getParser("TypeScript")).toBeNull();
    });
  });

  describe("getSupportedExtensions", () => {
    it("should return list of all supported extensions", () => {
      const parser1 = new MockParser([".ts", ".tsx"]);
      const parser2 = new MockParser([".js", ".jsx"]);

      registry.register("typescript", parser1);
      registry.register("javascript", parser2);

      const extensions = registry.getSupportedExtensions();

      expect(extensions).toHaveLength(4);
      expect(extensions).toContain(".ts");
      expect(extensions).toContain(".tsx");
      expect(extensions).toContain(".js");
      expect(extensions).toContain(".jsx");
    });

    it("should return empty array when no parsers registered", () => {
      const extensions = registry.getSupportedExtensions();
      expect(extensions).toHaveLength(0);
    });

    it("should not include duplicates", () => {
      const parser1 = new MockParser([".ts"]);
      const parser2 = new MockParser([".ts", ".tsx"]);

      registry.register("typescript", parser1);
      registry.register("typescript-tsx", parser2);

      const extensions = registry.getSupportedExtensions();

      // .ts should appear only once (overwritten)
      const tsCount = extensions.filter((e) => e === ".ts").length;
      expect(tsCount).toBe(1);
    });
  });

  describe("isSupported", () => {
    it("should return true for supported file", () => {
      const parser = new MockParser([".ts"]);
      registry.register("typescript", parser);

      expect(registry.isSupported("src/index.ts")).toBe(true);
    });

    it("should return false for unsupported file", () => {
      const parser = new MockParser([".ts"]);
      registry.register("typescript", parser);

      expect(registry.isSupported("src/index.py")).toBe(false);
    });

    it("should handle case-insensitive extensions", () => {
      const parser = new MockParser([".TS"]);
      registry.register("typescript", parser);

      expect(registry.isSupported("src/index.ts")).toBe(true);
      expect(registry.isSupported("src/index.TS")).toBe(true);
    });

    it("should return false when no parsers registered", () => {
      expect(registry.isSupported("any-file.ts")).toBe(false);
    });
  });

  describe("integration scenarios", () => {
    it("should handle multiple extensions per parser", () => {
      const tsParser = new MockParser([".ts", ".tsx", ".mts", ".cts"]);
      registry.register("typescript", tsParser);

      expect(registry.isSupported("index.ts")).toBe(true);
      expect(registry.isSupported("Component.tsx")).toBe(true);
      expect(registry.isSupported("module.mts")).toBe(true);
      expect(registry.isSupported("config.cts")).toBe(true);
      expect(registry.isSupported("script.js")).toBe(false);
    });

    it("should prioritize last registered parser for same extension", () => {
      const legacyParser = new MockParser([".ts"]);
      const newParser = new MockParser([".ts"]);

      registry.register("legacy-typescript", legacyParser);
      registry.register("modern-typescript", newParser);

      expect(registry.getParserForFile("index.ts")).toBe(newParser);
    });

    it("should support multiple independent parsers", () => {
      const tsParser = new MockParser([".ts", ".tsx"]);
      const jsParser = new MockParser([".js", ".jsx"]);
      const pyParser = new MockParser([".py"]);

      registry.register("typescript", tsParser);
      registry.register("javascript", jsParser);
      registry.register("python", pyParser);

      const extensions = registry.getSupportedExtensions();
      expect(extensions.length).toBeGreaterThanOrEqual(5);
      expect(registry.isSupported("index.ts")).toBe(true);
      expect(registry.isSupported("script.js")).toBe(true);
      expect(registry.isSupported("main.py")).toBe(true);
    });
  });
});
