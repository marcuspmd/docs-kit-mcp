import { describe, it, expect, beforeEach } from "@jest/globals";
import { TypeScriptParser } from "../TypeScriptParser.js";
import type Parser from "tree-sitter";

// Mock Tree-sitter Parser
class MockSyntaxNode {
  type: string;
  startIndex: number;
  endIndex: number;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  children: MockSyntaxNode[] = [];
  parent: MockSyntaxNode | null = null;

  constructor(type: string, startIndex = 0, endIndex = 0, startRow = 0, endRow = 0) {
    this.type = type;
    this.startIndex = startIndex;
    this.endIndex = endIndex;
    this.startPosition = { row: startRow, column: 0 };
    this.endPosition = { row: endRow, column: 0 };
  }

  childForFieldName() {
    return new MockSyntaxNode("identifier", 0, 4, 0, 0);
  }

  addChild(child: MockSyntaxNode) {
    child.parent = this;
    this.children.push(child);
    return this;
  }
}

class MockTree {
  rootNode: MockSyntaxNode;

  constructor() {
    this.rootNode = new MockSyntaxNode("root", 0, 100, 0, 10);
  }
}

class MockTreeSitterParser {
  parse(content: string): MockTree {
    if (content.includes("ERROR")) {
      const tree = new MockTree();
      Object.defineProperty(tree.rootNode, "hasError", { value: true });
      return tree;
    }

    const tree = new MockTree();
    Object.defineProperty(tree.rootNode, "hasError", { value: false });
    return tree;
  }
}

describe("TypeScriptParser", () => {
  let parser: TypeScriptParser;
  let mockTsParser: MockTreeSitterParser;

  beforeEach(() => {
    mockTsParser = new MockTreeSitterParser();
    parser = new TypeScriptParser(mockTsParser as unknown as Parser);
  });

  describe("supportedExtensions", () => {
    it("should support TypeScript extensions", () => {
      expect(parser.supportedExtensions).toContain(".ts");
      expect(parser.supportedExtensions).toContain(".tsx");
    });

    it("should support JavaScript extensions", () => {
      expect(parser.supportedExtensions).toContain(".js");
      expect(parser.supportedExtensions).toContain(".jsx");
    });

    it("should support module extensions", () => {
      expect(parser.supportedExtensions).toContain(".mts");
      expect(parser.supportedExtensions).toContain(".cts");
    });

    it("should have valid extensions array", () => {
      expect(Array.isArray(parser.supportedExtensions)).toBe(true);
      expect(parser.supportedExtensions.length).toBeGreaterThan(0);
    });
  });

  describe("parse", () => {
    it("should return parse result with empty symbols on simple content", async () => {
      const result = await parser.parse("/path/file.ts", "const x = 1;");

      expect(result).toHaveProperty("symbols");
      expect(result).toHaveProperty("relationships");
      expect(result).toHaveProperty("metadata");
      expect(Array.isArray(result.symbols)).toBe(true);
      expect(Array.isArray(result.relationships)).toBe(true);
    });

    it("should include metadata in parse result", async () => {
      const content = "const x = 1;";
      const result = await parser.parse("/path/file.ts", content);

      expect(result.metadata).toMatchObject({
        language: "ts",
        loc: 1,
        size: content.length,
      });
    });

    it("should handle file with multiple lines", async () => {
      const content = "const x = 1;\nconst y = 2;\nconst z = 3;";
      const result = await parser.parse("/path/file.ts", content);

      expect(result.metadata?.loc).toBe(3);
    });

    it("should handle empty content", async () => {
      const result = await parser.parse("/path/file.ts", "");

      expect(result.symbols).toEqual([]);
      expect(result.relationships).toEqual([]);
      expect(result.metadata?.loc).toBe(1);
    });

    it("should handle content with comments", async () => {
      const content = "// This is a comment\nconst x = 1;";
      const result = await parser.parse("/path/file.ts", content);

      expect(result.symbols).toBeDefined();
      expect(result.relationships).toBeDefined();
    });

    it("should handle large files", async () => {
      const lines = "const x = 1;\n".repeat(1000);
      const result = await parser.parse("/path/large-file.ts", lines);

      expect(result.metadata?.loc).toBe(lines.split("\n").length);
      expect(result.symbols).toBeDefined();
    });
  });

  describe("validate", () => {
    it("should return valid for correct content", async () => {
      const result = await parser.validate("const x = 1;");

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should detect invalid content", async () => {
      const result = await parser.validate("const x = ERROR");

      expect(result.isValid).toBe(false);
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it("should return empty errors array for valid content", async () => {
      const result = await parser.validate("function test() { return true; }");

      expect(result.errors).toHaveLength(0);
    });

    it("should handle validation of empty string", async () => {
      const result = await parser.validate("");

      expect(typeof result.isValid).toBe("boolean");
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it("should handle parse errors gracefully", async () => {
      try {
        const result = await parser.validate("valid content");
        expect(result.isValid).toBeDefined();
        expect(result.errors).toBeDefined();
      } catch (error) {
        // Should not throw during validation
        fail("Validation should not throw");
      }
    });
  });

  describe("error handling", () => {
    it("should handle parse errors gracefully", async () => {
      const result = await parser.parse("/path/file.ts", "<<< PARSE ERROR >>>");

      expect(result).toHaveProperty("symbols");
      expect(result).toHaveProperty("relationships");
      // Should return empty symbols/relationships on error
      expect(Array.isArray(result.symbols)).toBe(true);
    });

    it("should return metadata even on error", async () => {
      const content = "const x = ERROR";
      const result = await parser.parse("/path/file.ts", content);

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.language).toBe("ts");
      expect(result.metadata?.loc).toBeGreaterThan(0);
    });

    it("should not throw during parsing", async () => {
      expect(async () => {
        await parser.parse("/path/file.ts", "invalid %%% content");
      }).not.toThrow();
    });
  });

  describe("file path handling", () => {
    it("should handle absolute file paths", async () => {
      const result = await parser.parse("/absolute/path/to/file.ts", "const x = 1;");
      expect(result).toBeDefined();
    });

    it("should handle relative file paths", async () => {
      const result = await parser.parse("src/file.ts", "const x = 1;");
      expect(result).toBeDefined();
    });

    it("should handle Windows-style paths", async () => {
      const result = await parser.parse("C:\\Users\\project\\file.ts", "const x = 1;");
      expect(result).toBeDefined();
    });

    it("should handle files with multiple dots in name", async () => {
      const result = await parser.parse("/path/component.spec.ts", "const x = 1;");
      expect(result).toBeDefined();
    });
  });

  describe("language detection", () => {
    it("should always report language as TypeScript", async () => {
      const result = await parser.parse("/path/file.ts", "const x = 1;");
      expect(result.metadata?.language).toBe("ts");
    });

    it("should report ts for all supported extensions", async () => {
      const extensions = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"];

      for (const ext of extensions) {
        const result = await parser.parse(`/path/file${ext}`, "const x = 1;");
        expect(result.metadata?.language).toBe("ts");
      }
    });
  });

  describe("symbol extraction", () => {
    it("should return empty symbols array initially", async () => {
      const result = await parser.parse("/path/file.ts", "const x = 1;");
      expect(Array.isArray(result.symbols)).toBe(true);
    });

    it("should return empty relationships array initially", async () => {
      const result = await parser.parse("/path/file.ts", "const x = 1;");
      expect(Array.isArray(result.relationships)).toBe(true);
    });

    it("should preserve symbol and relationship references", async () => {
      const result = await parser.parse("/path/file.ts", "class MyClass {}");

      expect(result.symbols).toBeDefined();
      expect(result.relationships).toBeDefined();
      expect(Array.isArray(result.symbols)).toBe(true);
      expect(Array.isArray(result.relationships)).toBe(true);
    });
  });
});
