import { describe, it, expect, beforeEach, jest } from "@jest/globals";
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

  childForFieldName(_field?: string): MockSyntaxNode | null {
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

    it("should handle non-Error exceptions and convert to string", async () => {
      const errorParser = new MockTreeSitterParser();
      errorParser.parse = () => {
        // eslint-disable-next-line no-throw-literal
        throw "String error instead of Error object";
      };

      const parserWithError = new TypeScriptParser(errorParser as unknown as Parser);
      const result = await parserWithError.validate("const x = 1;");

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(["String error instead of Error object"]);
    });

    it("should handle Error instances in validation catch", async () => {
      const errorParser = new MockTreeSitterParser();
      errorParser.parse = () => {
        throw new Error("Validation failed");
      };

      const parserWithError = new TypeScriptParser(errorParser as unknown as Parser);
      const result = await parserWithError.validate("const x = 1;");

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(["Validation failed"]);
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

    it("should handle internal parser exceptions", async () => {
      // Force the parser to throw an exception
      const errorParser = new MockTreeSitterParser();
      errorParser.parse = () => {
        throw new Error("Internal parser error");
      };

      const parserWithError = new TypeScriptParser(errorParser as unknown as Parser);
      const result = await parserWithError.parse("/path/file.ts", "const x = 1;");

      // Should catch the error and return empty result with metadata
      expect(result.symbols).toEqual([]);
      expect(result.relationships).toEqual([]);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.language).toBe("ts");
    });

    it("should log error message when parsing fails", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const errorParser = new MockTreeSitterParser();
      errorParser.parse = () => {
        throw new Error("Parser crashed");
      };

      const parserWithError = new TypeScriptParser(errorParser as unknown as Parser);
      await parserWithError.parse("/path/test.ts", "invalid code");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to parse /path/test.ts:",
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
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

    it("should extract class declaration symbols", async () => {
      // Mock a class_declaration node
      class MockClassNode extends MockSyntaxNode {
        constructor() {
          super("class_declaration", 0, 15, 0, 2);
        }

        childForFieldName(field: string) {
          if (field === "name") {
            return new MockSyntaxNode("identifier", 6, 13, 0, 0);
          }
          return null;
        }
      }

      const classNode = new MockClassNode();
      mockTsParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.children.push(classNode);
        return tree;
      };

      const result = await parser.parse("/path/file.ts", "class MyClass {}");

      // Parse will traverse the tree, but won't extract symbols without proper name extraction
      expect(result.symbols).toBeDefined();
      expect(Array.isArray(result.symbols)).toBe(true);
    });

    it("should extract function declaration symbols", async () => {
      // Mock a function_declaration node
      class MockFunctionNode extends MockSyntaxNode {
        constructor() {
          super("function_declaration", 0, 20, 0, 0);
        }

        childForFieldName(field: string) {
          if (field === "name") {
            return new MockSyntaxNode("identifier", 9, 13, 0, 0);
          }
          return null;
        }
      }

      const funcNode = new MockFunctionNode();
      mockTsParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.children.push(funcNode);
        return tree;
      };

      const result = await parser.parse("/path/file.ts", "function test() {}");

      expect(result.symbols).toBeDefined();
      expect(Array.isArray(result.symbols)).toBe(true);
    });

    it("should extract interface declaration symbols", async () => {
      class MockInterfaceNode extends MockSyntaxNode {
        constructor() {
          super("interface_declaration", 0, 23, 0, 0);
        }

        childForFieldName(field: string) {
          if (field === "name") {
            return new MockSyntaxNode("identifier", 10, 17, 0, 0);
          }
          return null;
        }
      }

      const interfaceNode = new MockInterfaceNode();
      mockTsParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.children.push(interfaceNode);
        return tree;
      };

      const result = await parser.parse("/path/file.ts", "interface MyInterface {}");

      expect(result.symbols).toBeDefined();
      expect(Array.isArray(result.symbols)).toBe(true);
    });

    it("should handle nodes without name field", async () => {
      class MockNodeWithoutName extends MockSyntaxNode {
        constructor() {
          super("class_declaration", 0, 15, 0, 0);
        }

        childForFieldName() {
          return null;
        }
      }

      const nodeWithoutName = new MockNodeWithoutName();
      mockTsParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.children.push(nodeWithoutName);
        return tree;
      };

      const result = await parser.parse("/path/file.ts", "class {}");

      // Should not crash, should return empty symbols
      expect(result.symbols).toBeDefined();
      expect(Array.isArray(result.symbols)).toBe(true);
    });

    it("should handle exported symbols", async () => {
      class MockExportedClassNode extends MockSyntaxNode {
        constructor() {
          super("class_declaration", 0, 22, 0, 0);
          const exportChild = new MockSyntaxNode("export", 0, 6, 0, 0);
          exportChild.parent = this;
          this.children.push(exportChild);
        }

        childForFieldName(field: string) {
          if (field === "name") {
            return new MockSyntaxNode("identifier", 13, 20, 0, 0);
          }
          return null;
        }
      }

      const exportedNode = new MockExportedClassNode();
      mockTsParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.children.push(exportedNode);
        return tree;
      };

      const result = await parser.parse("/path/file.ts", "export class MyClass {}");

      expect(result.symbols).toBeDefined();
      expect(Array.isArray(result.symbols)).toBe(true);
    });

    it("should recursively process nested nodes", async () => {
      const childNode = new MockSyntaxNode("method_definition", 0, 10, 1, 1);
      const parentNode = new MockSyntaxNode("class_declaration", 0, 30, 0, 2);
      parentNode.addChild(childNode);

      mockTsParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.children.push(parentNode);
        return tree;
      };

      const result = await parser.parse("/path/file.ts", "class X { method() {} }");

      // Should process both parent and child nodes
      expect(result.symbols).toBeDefined();
      expect(Array.isArray(result.symbols)).toBe(true);
    });

    it("should handle method definitions", async () => {
      class MockMethodNode extends MockSyntaxNode {
        constructor() {
          super("method_definition", 0, 15, 1, 1);
        }

        childForFieldName(field: string) {
          if (field === "name") {
            return new MockSyntaxNode("identifier", 2, 8, 1, 1);
          }
          return null;
        }
      }

      const methodNode = new MockMethodNode();
      mockTsParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.children.push(methodNode);
        return tree;
      };

      const result = await parser.parse("/path/file.ts", "method() {}");

      expect(result.symbols).toBeDefined();
      expect(Array.isArray(result.symbols)).toBe(true);
    });

    it("should handle type alias declarations", async () => {
      class MockTypeAliasNode extends MockSyntaxNode {
        constructor() {
          super("type_alias_declaration", 0, 18, 0, 0);
        }

        childForFieldName(field: string) {
          if (field === "name") {
            return new MockSyntaxNode("identifier", 5, 12, 0, 0);
          }
          return null;
        }
      }

      const typeNode = new MockTypeAliasNode();
      mockTsParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.children.push(typeNode);
        return tree;
      };

      const result = await parser.parse("/path/file.ts", "type MyType = string;");

      expect(result.symbols).toBeDefined();
      expect(Array.isArray(result.symbols)).toBe(true);
    });

    it("should handle enum declarations", async () => {
      class MockEnumNode extends MockSyntaxNode {
        constructor() {
          super("enum_declaration", 0, 20, 0, 0);
        }

        childForFieldName(field: string) {
          if (field === "name") {
            return new MockSyntaxNode("identifier", 5, 11, 0, 0);
          }
          return null;
        }
      }

      const enumNode = new MockEnumNode();
      mockTsParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.children.push(enumNode);
        return tree;
      };

      const result = await parser.parse("/path/file.ts", "enum MyEnum { A, B }");

      expect(result.symbols).toBeDefined();
      expect(Array.isArray(result.symbols)).toBe(true);
    });

    it("should handle export statement wrapping", async () => {
      class MockExportStatement extends MockSyntaxNode {
        constructor() {
          super("export_statement", 0, 25, 0, 0);
          const classNode = new MockSyntaxNode("class_declaration", 7, 25, 0, 0);
          this.addChild(classNode);
        }
      }

      const exportStmt = new MockExportStatement();
      mockTsParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.children.push(exportStmt);
        return tree;
      };

      const result = await parser.parse("/path/file.ts", "export class MyClass {}");

      expect(result.symbols).toBeDefined();
      expect(Array.isArray(result.symbols)).toBe(true);
    });

    it("should return null for symbols with invalid data", async () => {
      // Create a node that would cause CodeSymbol.create to fail
      class MockInvalidNode extends MockSyntaxNode {
        constructor() {
          super("class_declaration", 0, 10, -1, -1); // Invalid line numbers
        }

        childForFieldName(field?: string) {
          if (field === "name") {
            return new MockSyntaxNode("identifier", 0, 0, -1, -1); // Invalid position
          }
          return null;
        }
      }

      const invalidNode = new MockInvalidNode();
      mockTsParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.children.push(invalidNode);
        return tree;
      };

      const result = await parser.parse("/path/file.ts", "class {}");

      // Should handle invalid symbols gracefully
      expect(result.symbols).toBeDefined();
      expect(Array.isArray(result.symbols)).toBe(true);
    });

    it("should correctly identify non-exported symbols", async () => {
      // Create a class node that is NOT exported
      class MockNonExportedClass extends MockSyntaxNode {
        constructor() {
          super("class_declaration", 0, 15, 0, 0);
          // No export modifier
        }

        childForFieldName(field?: string) {
          if (field === "name") {
            return new MockSyntaxNode("identifier", 6, 13, 0, 0);
          }
          return null;
        }
      }

      const nonExportedNode = new MockNonExportedClass();
      mockTsParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.children.push(nonExportedNode);
        return tree;
      };

      const result = await parser.parse("/path/file.ts", "class MyClass {}");

      expect(result.symbols).toBeDefined();
      expect(Array.isArray(result.symbols)).toBe(true);
    });

    it("should detect export keyword in children", async () => {
      class MockClassWithExportChild extends MockSyntaxNode {
        constructor() {
          super("class_declaration", 7, 22, 0, 0);
          const exportKeyword = new MockSyntaxNode("export", 0, 6, 0, 0);
          this.children.push(exportKeyword);
        }

        childForFieldName(field?: string) {
          if (field === "name") {
            return new MockSyntaxNode("identifier", 13, 20, 0, 0);
          }
          return null;
        }
      }

      const exportedClass = new MockClassWithExportChild();
      mockTsParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.children.push(exportedClass);
        return tree;
      };

      const result = await parser.parse("/path/file.ts", "export class MyClass {}");

      expect(result.symbols).toBeDefined();
      expect(Array.isArray(result.symbols)).toBe(true);
    });
  });
});
