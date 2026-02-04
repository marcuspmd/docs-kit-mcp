import { describe, it, expect, beforeEach } from "@jest/globals";
import { TypeScriptParser } from "../TypeScriptParser.js";
import type Parser from "tree-sitter";

// Mock classes para testes de relacionamentos
class MockNode {
  type: string;
  text: string;
  startIndex: number;
  endIndex: number;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  children: MockNode[] = [];
  parent: MockNode | null = null;

  constructor(type: string, text = "", startRow = 0, endRow = 0) {
    this.type = type;
    this.text = text;
    this.startIndex = 0;
    this.endIndex = text.length;
    this.startPosition = { row: startRow, column: 0 };
    this.endPosition = { row: endRow, column: 0 };
  }

  childForFieldName(field?: string): MockNode | null {
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

describe("TypeScriptParser - Relationship Coverage", () => {
  let parser: TypeScriptParser;
  let mockParser: MockTSParser;

  beforeEach(() => {
    mockParser = new MockTSParser();
    parser = new TypeScriptParser(mockParser as unknown as Parser);
  });

  describe("class relationships - extends", () => {
    it("should extract extends relationships with heritage clause", async () => {
      class MockClassWithExtends extends MockNode {
        constructor() {
          super("class_declaration", "", 0, 5);
          const heritage = new MockNode("class_heritage", "", 1, 1);
          const extendsClause = new MockNode("extends_clause", "", 1, 1);
          const identifier = new MockNode("identifier", "BaseClass", 1, 1);
          extendsClause.addChild(identifier);
          heritage.addChild(extendsClause);
          this.addChild(heritage);
        }

        childForFieldName(field?: string) {
          if (field === "name") {
            return new MockNode("identifier", "MyClass", 0, 0);
          }
          return null;
        }
      }

      const classNode = new MockClassWithExtends();
      mockParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.addChild(classNode);
        return tree;
      };

      const result = await parser.parse("/test.ts", "class MyClass extends BaseClass {}");
      expect(result.relationships.length).toBeGreaterThan(0);
      const extendsRel = result.relationships.find((r) => r.type === "inherits");
      expect(extendsRel).toBeDefined();
    });

    it("should extract extends relationships with type_identifier", async () => {
      class MockClassWithTypeExtends extends MockNode {
        constructor() {
          super("class_declaration", "", 0, 5);
          const heritage = new MockNode("class_heritage", "", 1, 1);
          const extendsClause = new MockNode("extends_clause", "", 1, 1);
          const typeIdentifier = new MockNode("type_identifier", "IBaseInterface", 1, 1);
          extendsClause.addChild(typeIdentifier);
          heritage.addChild(extendsClause);
          this.addChild(heritage);
        }

        childForFieldName(field?: string) {
          if (field === "name") {
            return new MockNode("identifier", "MyClass", 0, 0);
          }
          return null;
        }
      }

      const classNode = new MockClassWithTypeExtends();
      mockParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.addChild(classNode);
        return tree;
      };

      const result = await parser.parse("/test.ts", "class MyClass extends IBaseInterface {}");
      expect(result.relationships.length).toBeGreaterThan(0);
    });
  });

  describe("class relationships - implements", () => {
    it("should extract implements relationships", async () => {
      class MockClassWithImplements extends MockNode {
        constructor() {
          super("class_declaration", "", 0, 5);
          const heritage = new MockNode("class_heritage", "", 1, 1);
          const implementsClause = new MockNode("implements_clause", "", 1, 1);
          const typeId1 = new MockNode("type_identifier", "IFirstInterface", 1, 1);
          const typeId2 = new MockNode("identifier", "ISecondInterface", 1, 1);
          implementsClause.addChild(typeId1);
          implementsClause.addChild(typeId2);
          heritage.addChild(implementsClause);
          this.addChild(heritage);
        }

        childForFieldName(field?: string) {
          if (field === "name") {
            return new MockNode("identifier", "MyClass", 0, 0);
          }
          return null;
        }
      }

      const classNode = new MockClassWithImplements();
      mockParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.addChild(classNode);
        return tree;
      };

      const result = await parser.parse(
        "/test.ts",
        "class MyClass implements IFirstInterface, ISecondInterface {}",
      );
      const implementsRels = result.relationships.filter((r) => r.type === "implements");
      expect(implementsRels.length).toBeGreaterThan(0);
    });
  });
});
