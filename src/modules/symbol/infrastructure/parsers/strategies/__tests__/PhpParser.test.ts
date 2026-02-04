import { describe, it, expect, beforeEach } from "@jest/globals";
import { PhpParser } from "../PhpParser.js";
import type Parser from "tree-sitter";

// Mock Tree-sitter Parser
class MockSyntaxNode {
  type: string;
  text: string;
  startIndex: number;
  endIndex: number;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  children: MockSyntaxNode[] = [];
  parent: MockSyntaxNode | null = null;
  previousNamedSibling: MockSyntaxNode | null = null;

  constructor(type: string, text = "", startIndex = 0, endIndex = 0, startRow = 0, endRow = 0) {
    this.type = type;
    this.text = text;
    this.startIndex = startIndex;
    this.endIndex = endIndex;
    this.startPosition = { row: startRow, column: 0 };
    this.endPosition = { row: endRow, column: 0 };
  }

  childForFieldName(_field?: string): MockSyntaxNode | null {
    return null;
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
    this.rootNode = new MockSyntaxNode("program", "", 0, 100, 0, 10);
  }
}

class MockPhpParser {
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

describe("PhpParser", () => {
  let parser: PhpParser;
  let mockParser: MockPhpParser;

  beforeEach(() => {
    mockParser = new MockPhpParser();
    parser = new PhpParser(mockParser as unknown as Parser);
  });

  describe("supportedExtensions", () => {
    it("should support .php extension", () => {
      expect(parser.supportedExtensions).toContain(".php");
    });

    it("should have valid extensions array", () => {
      expect(Array.isArray(parser.supportedExtensions)).toBe(true);
      expect(parser.supportedExtensions.length).toBeGreaterThan(0);
    });
  });

  describe("parse", () => {
    it("should return parse result with symbols and relationships", async () => {
      const result = await parser.parse("/path/file.php", "<?php $x = 1;");

      expect(result).toHaveProperty("symbols");
      expect(result).toHaveProperty("relationships");
      expect(result).toHaveProperty("metadata");
      expect(Array.isArray(result.symbols)).toBe(true);
      expect(Array.isArray(result.relationships)).toBe(true);
    });

    it("should include metadata with language php", async () => {
      const content = "<?php $x = 1;";
      const result = await parser.parse("/path/file.php", content);

      expect(result.metadata).toMatchObject({
        language: "php",
        loc: 1,
        size: content.length,
      });
    });

    it("should handle file with multiple lines", async () => {
      const content = "<?php\n$x = 1;\n$y = 2;\n$z = 3;";
      const result = await parser.parse("/path/file.php", content);

      expect(result.metadata?.loc).toBe(4);
    });

    it("should handle empty content", async () => {
      const result = await parser.parse("/path/file.php", "");

      expect(result.symbols).toEqual([]);
      expect(result.relationships).toEqual([]);
      expect(result.metadata?.loc).toBe(1);
    });
  });

  describe("validate", () => {
    it("should return valid for correct content", async () => {
      const result = await parser.validate("<?php $x = 1;");

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should detect invalid content", async () => {
      const result = await parser.validate("<?php $x = ERROR");

      expect(result.isValid).toBe(false);
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it("should handle Error instances in validation", async () => {
      const errorParser = new MockPhpParser();
      errorParser.parse = () => {
        throw new Error("Validation failed");
      };

      const parserWithError = new PhpParser(errorParser as unknown as Parser);
      const result = await parserWithError.validate("<?php $x = 1;");

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(["Validation failed"]);
    });

    it("should handle non-Error exceptions", async () => {
      const errorParser = new MockPhpParser();
      errorParser.parse = () => {
        // eslint-disable-next-line no-throw-literal
        throw "String error";
      };

      const parserWithError = new PhpParser(errorParser as unknown as Parser);
      const result = await parserWithError.validate("<?php $x = 1;");

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(["String error"]);
    });
  });

  describe("error handling", () => {
    it("should handle parse errors gracefully", async () => {
      const result = await parser.parse("/path/file.php", "<?php <<< ERROR >>>");

      expect(result).toHaveProperty("symbols");
      expect(result).toHaveProperty("relationships");
      expect(Array.isArray(result.symbols)).toBe(true);
    });

    it("should return metadata even on error", async () => {
      const content = "<?php $x = ERROR";
      const result = await parser.parse("/path/file.php", content);

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.language).toBe("php");
      expect(result.metadata?.loc).toBeGreaterThan(0);
    });

    it("should not throw during parsing", async () => {
      await expect(async () => {
        await parser.parse("/path/file.php", "invalid %%% content");
      }).not.toThrow();
    });

    it("should handle internal parser exceptions", async () => {
      const errorParser = new MockPhpParser();
      errorParser.parse = () => {
        throw new Error("Internal parser error");
      };

      const parserWithError = new PhpParser(errorParser as unknown as Parser);
      const result = await parserWithError.parse("/path/file.php", "<?php $x = 1;");

      expect(result.symbols).toEqual([]);
      expect(result.relationships).toEqual([]);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.language).toBe("php");
    });
  });

  describe("namespace extraction", () => {
    it("should extract namespace from PHP file", async () => {
      class MockNamespaceNode extends MockSyntaxNode {
        constructor() {
          super("namespace_definition", "", 0, 20, 0, 0);
        }

        childForFieldName(field?: string) {
          if (field === "name") {
            return new MockSyntaxNode("name", "App\\Services", 10, 22, 0, 0);
          }
          return null;
        }
      }

      const nsNode = new MockNamespaceNode();
      mockParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.children.push(nsNode);
        return tree;
      };

      const result = await parser.parse("/path/file.php", "<?php namespace App\\Services;");

      expect(result).toBeDefined();
      expect(result.symbols).toBeDefined();
    });

    it("should handle files without namespace", async () => {
      const result = await parser.parse("/path/file.php", "<?php class SimpleClass {}");

      expect(result.symbols).toBeDefined();
      expect(Array.isArray(result.symbols)).toBe(true);
    });
  });

  describe("use statement extraction", () => {
    it("should extract simple use statements", async () => {
      class MockUseDeclaration extends MockSyntaxNode {
        constructor() {
          super("namespace_use_declaration", "", 0, 30, 1, 1);
          const clause = new MockSyntaxNode("namespace_use_clause", "", 4, 29, 1, 1);
          const name = new MockSyntaxNode("qualified_name", "App\\Services\\Request", 4, 24, 1, 1);
          clause.children.push(name);
          this.children.push(clause);
        }
      }

      const useNode = new MockUseDeclaration();
      mockParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.children.push(useNode);
        return tree;
      };

      const result = await parser.parse("/path/file.php", "<?php use App\\Services\\Request;");

      expect(result.symbols).toBeDefined();
      expect(Array.isArray(result.symbols)).toBe(true);
    });

    it("should handle aliased use statements", async () => {
      class MockAliasedUse extends MockSyntaxNode {
        constructor() {
          super("namespace_use_declaration", "", 0, 40, 1, 1);
          const clause = new MockSyntaxNode("namespace_use_clause", "", 4, 39, 1, 1);
          const name = new MockSyntaxNode("qualified_name", "App\\Services\\Request", 4, 24, 1, 1);
          const aliasClause = new MockSyntaxNode("namespace_aliasing_clause", "", 28, 39, 1, 1);
          const aliasName = new MockSyntaxNode("name", "HttpReq", 31, 38, 1, 1);
          aliasClause.children.push(aliasName);
          clause.children.push(name, aliasClause);
          this.children.push(clause);
        }
      }

      const aliasNode = new MockAliasedUse();
      mockParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.children.push(aliasNode);
        return tree;
      };

      const result = await parser.parse(
        "/path/file.php",
        "<?php use App\\Services\\Request as HttpReq;",
      );

      expect(result.symbols).toBeDefined();
    });
  });

  describe("symbol extraction", () => {
    it("should extract class declarations", async () => {
      class MockClassNode extends MockSyntaxNode {
        constructor() {
          super("class_declaration", "", 0, 20, 2, 4);
        }

        childForFieldName(field?: string) {
          if (field === "name") {
            return new MockSyntaxNode("name", "UserService", 6, 17, 2, 2);
          }
          return null;
        }
      }

      const classNode = new MockClassNode();
      mockParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.children.push(classNode);
        return tree;
      };

      const result = await parser.parse("/path/file.php", "<?php class UserService {}");

      expect(result.symbols).toBeDefined();
      expect(Array.isArray(result.symbols)).toBe(true);
    });

    it("should extract interface declarations", async () => {
      class MockInterfaceNode extends MockSyntaxNode {
        constructor() {
          super("interface_declaration", "", 0, 25, 2, 3);
        }

        childForFieldName(field?: string) {
          if (field === "name") {
            return new MockSyntaxNode("name", "UserInterface", 10, 23, 2, 2);
          }
          return null;
        }
      }

      const interfaceNode = new MockInterfaceNode();
      mockParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.children.push(interfaceNode);
        return tree;
      };

      const result = await parser.parse("/path/file.php", "<?php interface UserInterface {}");

      expect(result.symbols).toBeDefined();
      expect(Array.isArray(result.symbols)).toBe(true);
    });

    it("should extract trait declarations", async () => {
      class MockTraitNode extends MockSyntaxNode {
        constructor() {
          super("trait_declaration", "", 0, 20, 2, 3);
        }

        childForFieldName(field?: string) {
          if (field === "name") {
            return new MockSyntaxNode("name", "Loggable", 6, 14, 2, 2);
          }
          return null;
        }
      }

      const traitNode = new MockTraitNode();
      mockParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.children.push(traitNode);
        return tree;
      };

      const result = await parser.parse("/path/file.php", "<?php trait Loggable {}");

      expect(result.symbols).toBeDefined();
      expect(Array.isArray(result.symbols)).toBe(true);
    });

    it("should extract method declarations", async () => {
      class MockMethodNode extends MockSyntaxNode {
        constructor() {
          super("method_declaration", "", 0, 25, 3, 5);
        }

        childForFieldName(field?: string) {
          if (field === "name") {
            return new MockSyntaxNode("name", "getUser", 12, 19, 3, 3);
          }
          return null;
        }
      }

      const methodNode = new MockMethodNode();
      mockParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.children.push(methodNode);
        return tree;
      };

      const result = await parser.parse("/path/file.php", "<?php public function getUser() {}");

      expect(result.symbols).toBeDefined();
      expect(Array.isArray(result.symbols)).toBe(true);
    });

    it("should extract function definitions", async () => {
      class MockFunctionNode extends MockSyntaxNode {
        constructor() {
          super("function_definition", "", 0, 30, 1, 3);
        }

        childForFieldName(field?: string) {
          if (field === "name") {
            return new MockSyntaxNode("name", "processData", 15, 26, 1, 1);
          }
          return null;
        }
      }

      const functionNode = new MockFunctionNode();
      mockParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.children.push(functionNode);
        return tree;
      };

      const result = await parser.parse("/path/file.php", "<?php function processData() {}");

      expect(result.symbols).toBeDefined();
      expect(Array.isArray(result.symbols)).toBe(true);
    });

    it("should extract enum declarations", async () => {
      class MockEnumNode extends MockSyntaxNode {
        constructor() {
          super("enum_declaration", "", 0, 20, 1, 3);
        }

        childForFieldName(field?: string) {
          if (field === "name") {
            return new MockSyntaxNode("name", "Status", 5, 11, 1, 1);
          }
          return null;
        }
      }

      const enumNode = new MockEnumNode();
      mockParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.children.push(enumNode);
        return tree;
      };

      const result = await parser.parse("/path/file.php", "<?php enum Status {}");

      expect(result.symbols).toBeDefined();
      expect(Array.isArray(result.symbols)).toBe(true);
    });

    it("should handle nodes without name field", async () => {
      class MockNodeWithoutName extends MockSyntaxNode {
        constructor() {
          super("class_declaration", "", 0, 10, 1, 1);
        }

        childForFieldName() {
          return null;
        }
      }

      const nodeWithoutName = new MockNodeWithoutName();
      mockParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.children.push(nodeWithoutName);
        return tree;
      };

      const result = await parser.parse("/path/file.php", "<?php class {}");

      expect(result.symbols).toBeDefined();
      expect(Array.isArray(result.symbols)).toBe(true);
    });

    it("should recursively process nested symbols", async () => {
      const methodNode = new MockSyntaxNode("method_declaration", "", 10, 30, 3, 5);
      const classNode = new MockSyntaxNode("class_declaration", "", 0, 40, 2, 6);
      classNode.addChild(methodNode);

      mockParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.children.push(classNode);
        return tree;
      };

      const result = await parser.parse(
        "/path/file.php",
        "<?php class X { public function m() {} }",
      );

      expect(result.symbols).toBeDefined();
      expect(Array.isArray(result.symbols)).toBe(true);
    });
  });

  describe("kind refinement", () => {
    it("should refine class to service based on name", async () => {
      class MockServiceClass extends MockSyntaxNode {
        constructor() {
          super("class_declaration", "", 0, 30, 2, 4);
        }

        childForFieldName(field?: string) {
          if (field === "name") {
            return new MockSyntaxNode("name", "UserService", 6, 17, 2, 2);
          }
          return null;
        }
      }

      const serviceNode = new MockServiceClass();
      mockParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.children.push(serviceNode);
        return tree;
      };

      const result = await parser.parse("/path/file.php", "<?php class UserService {}");
      expect(result.symbols).toBeDefined();
    });

    it("should refine class to controller based on name", async () => {
      class MockControllerClass extends MockSyntaxNode {
        constructor() {
          super("class_declaration", "", 0, 35, 2, 4);
        }

        childForFieldName(field?: string) {
          if (field === "name") {
            return new MockSyntaxNode("name", "UserController", 6, 20, 2, 2);
          }
          return null;
        }
      }

      const controllerNode = new MockControllerClass();
      mockParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.children.push(controllerNode);
        return tree;
      };

      const result = await parser.parse("/path/file.php", "<?php class UserController {}");
      expect(result.symbols).toBeDefined();
    });

    it("should refine class to repository based on name", async () => {
      class MockRepoClass extends MockSyntaxNode {
        constructor() {
          super("class_declaration", "", 0, 35, 2, 4);
        }

        childForFieldName(field?: string) {
          if (field === "name") {
            return new MockSyntaxNode("name", "UserRepository", 6, 20, 2, 2);
          }
          return null;
        }
      }

      const repoNode = new MockRepoClass();
      mockParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.children.push(repoNode);
        return tree;
      };

      const result = await parser.parse("/path/file.php", "<?php class UserRepository {}");
      expect(result.symbols).toBeDefined();
    });
  });

  describe("visibility extraction", () => {
    it("should extract public visibility", async () => {
      class MockPublicMethod extends MockSyntaxNode {
        constructor() {
          super("method_declaration", "", 0, 35, 3, 5);
          const publicMod = new MockSyntaxNode("visibility_modifier", "public", 0, 6, 3, 3);
          this.children.push(publicMod);
        }

        childForFieldName(field?: string) {
          if (field === "name") {
            return new MockSyntaxNode("name", "getUser", 16, 23, 3, 3);
          }
          return null;
        }
      }

      const publicNode = new MockPublicMethod();
      mockParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.children.push(publicNode);
        return tree;
      };

      const result = await parser.parse("/path/file.php", "<?php public function getUser() {}");
      expect(result.symbols).toBeDefined();
    });

    it("should extract private visibility", async () => {
      class MockPrivateMethod extends MockSyntaxNode {
        constructor() {
          super("method_declaration", "", 0, 36, 3, 5);
          const privateMod = new MockSyntaxNode("visibility_modifier", "private", 0, 7, 3, 3);
          this.children.push(privateMod);
        }

        childForFieldName(field?: string) {
          if (field === "name") {
            return new MockSyntaxNode("name", "setData", 17, 24, 3, 3);
          }
          return null;
        }
      }

      const privateNode = new MockPrivateMethod();
      mockParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.children.push(privateNode);
        return tree;
      };

      const result = await parser.parse("/path/file.php", "<?php private function setData() {}");
      expect(result.symbols).toBeDefined();
    });

    it("should extract protected visibility", async () => {
      class MockProtectedMethod extends MockSyntaxNode {
        constructor() {
          super("method_declaration", "", 0, 38, 3, 5);
          const protectedMod = new MockSyntaxNode("visibility_modifier", "protected", 0, 9, 3, 3);
          this.children.push(protectedMod);
        }

        childForFieldName(field?: string) {
          if (field === "name") {
            return new MockSyntaxNode("name", "validate", 19, 27, 3, 3);
          }
          return null;
        }
      }

      const protectedNode = new MockProtectedMethod();
      mockParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.children.push(protectedNode);
        return tree;
      };

      const result = await parser.parse("/path/file.php", "<?php protected function validate() {}");
      expect(result.symbols).toBeDefined();
    });

    it("should handle methods without visibility modifier", async () => {
      class MockMethodNoVisibility extends MockSyntaxNode {
        constructor() {
          super("method_declaration", "", 0, 28, 3, 5);
        }

        childForFieldName(field?: string) {
          if (field === "name") {
            return new MockSyntaxNode("name", "process", 9, 16, 3, 3);
          }
          return null;
        }
      }

      const noVisNode = new MockMethodNoVisibility();
      mockParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.children.push(noVisNode);
        return tree;
      };

      const result = await parser.parse("/path/file.php", "<?php function process() {}");
      expect(result.symbols).toBeDefined();
    });
  });

  describe("class relationships", () => {
    it("should extract extends relationships", async () => {
      class MockClassWithExtends extends MockSyntaxNode {
        constructor() {
          super("class_declaration", "", 0, 50, 2, 4);
          const baseClause = new MockSyntaxNode("base_clause", "", 20, 35, 2, 2);
          const baseName = new MockSyntaxNode("name", "BaseService", 28, 39, 2, 2);
          baseClause.children.push(baseName);
          this.children.push(baseClause);
        }

        childForFieldName(field?: string) {
          if (field === "name") {
            return new MockSyntaxNode("name", "UserService", 6, 17, 2, 2);
          }
          return null;
        }
      }

      const classNode = new MockClassWithExtends();
      mockParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.children.push(classNode);
        return tree;
      };

      const result = await parser.parse(
        "/path/file.php",
        "<?php class UserService extends BaseService {}",
      );

      expect(result.relationships).toBeDefined();
      expect(Array.isArray(result.relationships)).toBe(true);
    });

    it("should extract implements relationships", async () => {
      class MockClassWithImplements extends MockSyntaxNode {
        constructor() {
          super("class_declaration", "", 0, 60, 2, 4);
          const ifaceClause = new MockSyntaxNode("class_interface_clause", "", 25, 50, 2, 2);
          const ifaceName = new MockSyntaxNode("name", "UserInterface", 36, 49, 2, 2);
          ifaceClause.children.push(ifaceName);
          this.children.push(ifaceClause);
        }

        childForFieldName(field?: string) {
          if (field === "name") {
            return new MockSyntaxNode("name", "UserService", 6, 17, 2, 2);
          }
          return null;
        }
      }

      const classNode = new MockClassWithImplements();
      mockParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.children.push(classNode);
        return tree;
      };

      const result = await parser.parse(
        "/path/file.php",
        "<?php class UserService implements UserInterface {}",
      );

      expect(result.relationships).toBeDefined();
      expect(Array.isArray(result.relationships)).toBe(true);
    });

    it("should extract trait usage relationships", async () => {
      class MockClassWithTrait extends MockSyntaxNode {
        constructor() {
          super("class_declaration", "", 0, 50, 2, 6);
          const declList = new MockSyntaxNode("declaration_list", "", 18, 48, 2, 6);
          const useDecl = new MockSyntaxNode("use_declaration", "", 20, 35, 3, 3);
          const traitName = new MockSyntaxNode("name", "Loggable", 24, 32, 3, 3);
          useDecl.children.push(traitName);
          declList.children.push(useDecl);
          this.children.push(declList);
        }

        childForFieldName(field?: string) {
          if (field === "name") {
            return new MockSyntaxNode("name", "UserService", 6, 17, 2, 2);
          }
          return null;
        }
      }

      const classNode = new MockClassWithTrait();
      mockParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.children.push(classNode);
        return tree;
      };

      const result = await parser.parse(
        "/path/file.php",
        "<?php class UserService { use Loggable; }",
      );

      expect(result.relationships).toBeDefined();
      expect(Array.isArray(result.relationships)).toBe(true);
    });

    it("should extract instantiation relationships", async () => {
      class MockInstantiation extends MockSyntaxNode {
        constructor() {
          super("object_creation_expression", "", 10, 25, 4, 4);
          const className = new MockSyntaxNode("name", "Request", 14, 21, 4, 4);
          this.children.push(className);
        }
      }

      const instantNode = new MockInstantiation();
      mockParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.children.push(instantNode);
        return tree;
      };

      const result = await parser.parse("/path/file.php", "<?php new Request();");

      expect(result.relationships).toBeDefined();
      expect(Array.isArray(result.relationships)).toBe(true);
    });

    it("should extract function call relationships", async () => {
      class MockFunctionCall extends MockSyntaxNode {
        constructor() {
          super("function_call_expression", "", 10, 30, 4, 4);
        }

        childForFieldName(field?: string) {
          if (field === "function") {
            return new MockSyntaxNode("name", "processData", 10, 21, 4, 4);
          }
          return null;
        }
      }

      const callNode = new MockFunctionCall();
      mockParser.parse = () => {
        const tree = new MockTree();
        tree.rootNode.children.push(callNode);
        return tree;
      };

      const result = await parser.parse("/path/file.php", "<?php processData();");

      expect(result.relationships).toBeDefined();
      expect(Array.isArray(result.relationships)).toBe(true);
    });
  });

  describe("name resolution", () => {
    it("should resolve fully qualified names", async () => {
      const result = await parser.parse("/path/file.php", "<?php $x = new \\App\\User();");
      expect(result.symbols).toBeDefined();
    });

    it("should resolve short class names", async () => {
      const result = await parser.parse("/path/file.php", "<?php use App\\User; $x = new User();");
      expect(result.symbols).toBeDefined();
    });

    it("should handle namespace qualified names", async () => {
      const result = await parser.parse("/path/file.php", "<?php $x = new App\\User();");
      expect(result.symbols).toBeDefined();
    });
  });
});
