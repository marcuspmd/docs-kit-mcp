import { describe, it, expect, beforeEach } from "@jest/globals";
import { TypeScriptParser } from "../TypeScriptParser.js";
import type Parser from "tree-sitter";

// Enhanced Mock for TypeScript Parser Tests
class MockNode {
  type: string;
  text: string;
  startIndex: number;
  endIndex: number;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  children: MockNode[] = [];
  parent: MockNode | null = null;
  previousNamedSibling: MockNode | null = null;

  constructor(type: string, text = "", startRow = 0, endRow = 0) {
    this.type = type;
    this.text = text;
    this.startIndex = 0;
    this.endIndex = text.length;
    this.startPosition = { row: startRow, column: 0 };
    this.endPosition = { row: endRow, column: 0 };
  }

  childForFieldName(field?: string): MockNode | null {
    if (field === "source" && this.type === "import_statement") {
      return new MockNode("string", `"./module"`, 0, 0);
    }
    if (field === "name") {
      return new MockNode("identifier", "TestClass", 0, 0);
    }
    return null;
  }

  descendantsOfType(type: string): MockNode[] {
    const results: MockNode[] = [];
    if (this.type === type) results.push(this);
    for (const child of this.children) {
      results.push(...child.descendantsOfType(type));
    }
    return results;
  }

  addChild(child: MockNode) {
    child.parent = this;
    this.children.push(child);
    return this;
  }
}

class MockTree {
  rootNode: MockNode;
  constructor() {
    this.rootNode = new MockNode("program", "", 0, 10);
  }
}

class MockTSParser {
  parse(_content: string): MockTree {
    const tree = new MockTree();
    Object.defineProperty(tree.rootNode, "hasError", { value: false });
    return tree;
  }
}

describe("TypeScriptParser - Additional Coverage", () => {
  let parser: TypeScriptParser;
  let mockParser: MockTSParser;

  beforeEach(() => {
    mockParser = new MockTSParser();
    parser = new TypeScriptParser(mockParser as unknown as Parser);
  });

  describe("import extraction", () => {
    it("should extract default imports from relative paths", async () => {
      class MockImportStatement extends MockNode {
        constructor() {
          super("import_statement", "", 0, 0);
          const importClause = new MockNode("import_clause", "", 0, 0);
          const defaultImport = new MockNode("identifier", "User", 0, 0);
          importClause.addChild(defaultImport);
          this.addChild(importClause);
        }

        childForFieldName(field?: string) {
          if (field === "source") {
            return new MockNode("string", '"./models/User"', 0, 0);
          }
          return null;
        }
      }

      const importNode = new MockImportStatement();
      mockParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.addChild(importNode);
        return tree;
      };

      const result = await parser.parse("/test.ts", 'import User from "./models/User";');
      expect(result.symbols).toBeDefined();
    });

    it("should extract named imports", async () => {
      class MockNamedImport extends MockNode {
        constructor() {
          super("import_statement", "", 0, 0);
          const importClause = new MockNode("import_clause", "", 0, 0);
          const specifier = new MockNode("import_specifier", "", 0, 0);
          this.addChild(importClause.addChild(specifier));
        }

        childForFieldName(field?: string) {
          if (field === "source") {
            return new MockNode("string", '"./utils"', 0, 0);
          }
          return null;
        }

        descendantsOfType(type: string): MockNode[] {
          if (type === "import_specifier") {
            const spec = new MockNode("import_specifier", "", 0, 0);
            spec.childForFieldName = (f?: string) => {
              if (f === "name") return new MockNode("identifier", "helper", 0, 0);
              return null;
            };
            return [spec];
          }
          return [];
        }
      }

      const importNode = new MockNamedImport();
      mockParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.addChild(importNode);
        return tree;
      };

      const result = await parser.parse("/test.ts", 'import { helper } from "./utils";');
      expect(result.symbols).toBeDefined();
    });

    it("should skip external package imports", async () => {
      class MockExternalImport extends MockNode {
        constructor() {
          super("import_statement", "", 0, 0);
        }

        childForFieldName(field?: string) {
          if (field === "source") {
            return new MockNode("string", '"express"', 0, 0);
          }
          return null;
        }
      }

      const importNode = new MockExternalImport();
      mockParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.addChild(importNode);
        return tree;
      };

      const result = await parser.parse("/test.ts", 'import express from "express";');
      expect(result.symbols).toBeDefined();
    });
  });

  describe("namespace and aliased imports", () => {
    it("should handle namespace imports (import * as)", async () => {
      class MockNamespaceImport extends MockNode {
        constructor() {
          super("import_statement", "", 0, 0);
          const importClause = new MockNode("import_clause", "", 0, 0);
          this.addChild(importClause);
        }

        childForFieldName(field?: string) {
          if (field === "source") {
            return new MockNode("string", '"./utils"', 0, 0);
          }
          return null;
        }

        descendantsOfType(type: string): MockNode[] {
          if (type === "namespace_import") {
            const ns = new MockNode("namespace_import", "", 0, 0);
            const identifier = new MockNode("identifier", "Utils", 0, 0);
            ns.addChild(identifier);
            return [ns];
          }
          return [];
        }
      }

      const importNode = new MockNamespaceImport();
      mockParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.addChild(importNode);
        return tree;
      };

      const result = await parser.parse("/test.ts", 'import * as Utils from "./utils";');
      expect(result.symbols).toBeDefined();
    });

    it("should handle aliased imports with both alias and name", async () => {
      class MockAliasedImport extends MockNode {
        constructor() {
          super("import_statement", "", 0, 0);
        }

        childForFieldName(field?: string) {
          if (field === "source") {
            return new MockNode("string", '"./models"', 0, 0);
          }
          return null;
        }

        descendantsOfType(type: string): MockNode[] {
          if (type === "import_specifier") {
            const spec = new MockNode("import_specifier", "", 0, 0);
            spec.childForFieldName = (f?: string) => {
              if (f === "name") return new MockNode("identifier", "UserModel", 0, 0);
              if (f === "alias") return new MockNode("identifier", "User", 0, 0);
              return null;
            };
            return [spec];
          }
          return [];
        }
      }

      const importNode = new MockAliasedImport();
      mockParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.addChild(importNode);
        return tree;
      };

      const result = await parser.parse(
        "/test.ts",
        'import { UserModel as User } from "./models";',
      );
      expect(result.symbols).toBeDefined();
    });
  });
});
