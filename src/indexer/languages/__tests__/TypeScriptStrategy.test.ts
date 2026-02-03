import { jest } from "@jest/globals";
import type Parser from "tree-sitter";
import type { CodeSymbol } from "../../symbol.types.js";
import { TypeScriptStrategy } from "../typescriptStrategy.js";

// Mock tree-sitter
const mockSyntaxNode = {
  type: "mock",
  text: "mock",
  children: [],
  childForFieldName: jest.fn(),
  previousNamedSibling: null,
  startPosition: { row: 0, column: 0 },
} as unknown as Parser.SyntaxNode;

describe("TypeScriptStrategy", () => {
  let strategy: TypeScriptStrategy;

  beforeEach(() => {
    strategy = new TypeScriptStrategy();
  });

  describe("extractNamespace", () => {
    it("should return undefined", () => {
      expect(strategy.extractNamespace(mockSyntaxNode)).toBeUndefined();
    });
  });

  describe("buildQualifiedName", () => {
    it("should return name if no parent", () => {
      expect(strategy.buildQualifiedName("MyClass")).toBe("MyClass");
    });

    it("should return qualified name with parent", () => {
      expect(strategy.buildQualifiedName("MyClass", "Parent")).toBe("Parent.MyClass");
    });

    it("should ignore namespace", () => {
      expect(strategy.buildQualifiedName("MyClass", "Parent", "Namespace")).toBe("Parent.MyClass");
    });
  });

  describe("extractExtends", () => {
    it("should return undefined if no class_heritage", () => {
      const node = { ...mockSyntaxNode, children: [] };
      expect(strategy.extractExtends(node)).toBeUndefined();
    });

    it("should return undefined if no extends_clause", () => {
      const heritage = { ...mockSyntaxNode, type: "class_heritage", children: [] };
      const node = { ...mockSyntaxNode, children: [heritage] };
      expect(strategy.extractExtends(node)).toBeUndefined();
    });

    it("should extract extends from identifier", () => {
      const typeNode = { ...mockSyntaxNode, type: "identifier", text: "BaseClass" };
      const extendsClause = { ...mockSyntaxNode, type: "extends_clause", children: [typeNode] };
      const heritage = { ...mockSyntaxNode, type: "class_heritage", children: [extendsClause] };
      const node = { ...mockSyntaxNode, children: [heritage] };
      expect(strategy.extractExtends(node)).toBe("BaseClass");
    });

    it("should extract extends from type_identifier", () => {
      const typeNode = { ...mockSyntaxNode, type: "type_identifier", text: "BaseClass" };
      const extendsClause = { ...mockSyntaxNode, type: "extends_clause", children: [typeNode] };
      const heritage = { ...mockSyntaxNode, type: "class_heritage", children: [extendsClause] };
      const node = { ...mockSyntaxNode, children: [heritage] };
      expect(strategy.extractExtends(node)).toBe("BaseClass");
    });
  });

  describe("extractImplements", () => {
    it("should return undefined if no class_heritage", () => {
      const node = { ...mockSyntaxNode, children: [] };
      expect(strategy.extractImplements(node)).toBeUndefined();
    });

    it("should return undefined if no implements_clause", () => {
      const heritage = { ...mockSyntaxNode, type: "class_heritage", children: [] };
      const node = { ...mockSyntaxNode, children: [heritage] };
      expect(strategy.extractImplements(node)).toBeUndefined();
    });

    it("should extract implements from type_identifiers", () => {
      const type1 = { ...mockSyntaxNode, type: "type_identifier", text: "Interface1" };
      const type2 = { ...mockSyntaxNode, type: "type_identifier", text: "Interface2" };
      const implClause = { ...mockSyntaxNode, type: "implements_clause", children: [type1, type2] };
      const heritage = { ...mockSyntaxNode, type: "class_heritage", children: [implClause] };
      const node = { ...mockSyntaxNode, children: [heritage] };
      expect(strategy.extractImplements(node)).toEqual(["Interface1", "Interface2"]);
    });

    it("should return undefined if no types", () => {
      const implClause = { ...mockSyntaxNode, type: "implements_clause", children: [] };
      const heritage = { ...mockSyntaxNode, type: "class_heritage", children: [implClause] };
      const node = { ...mockSyntaxNode, children: [heritage] };
      expect(strategy.extractImplements(node)).toBeUndefined();
    });
  });

  describe("extractTraits", () => {
    it("should return undefined", () => {
      expect(strategy.extractTraits(mockSyntaxNode)).toBeUndefined();
    });
  });

  describe("extractVisibility", () => {
    it("should return undefined if no accessibility_modifier", () => {
      const node = { ...mockSyntaxNode, children: [] };
      expect(strategy.extractVisibility(node)).toBeUndefined();
    });

    it("should extract public visibility", () => {
      const modifier = { ...mockSyntaxNode, type: "accessibility_modifier", text: "public" };
      const node = { ...mockSyntaxNode, children: [modifier] };
      expect(strategy.extractVisibility(node)).toBe("public");
    });

    it("should extract private visibility", () => {
      const modifier = { ...mockSyntaxNode, type: "accessibility_modifier", text: "private" };
      const node = { ...mockSyntaxNode, children: [modifier] };
      expect(strategy.extractVisibility(node)).toBe("private");
    });

    it("should extract protected visibility", () => {
      const modifier = { ...mockSyntaxNode, type: "accessibility_modifier", text: "protected" };
      const node = { ...mockSyntaxNode, children: [modifier] };
      expect(strategy.extractVisibility(node)).toBe("protected");
    });

    it("should return undefined for invalid modifier", () => {
      const modifier = { ...mockSyntaxNode, type: "accessibility_modifier", text: "internal" };
      const node = { ...mockSyntaxNode, children: [modifier] };
      expect(strategy.extractVisibility(node)).toBeUndefined();
    });
  });

  describe("refineKind", () => {
    it("should return the same kind", () => {
      expect(strategy.refineKind("class", "MyClass")).toBe("class");
      expect(strategy.refineKind("method", "myMethod")).toBe("method");
    });
  });

  describe("detectDeprecated", () => {
    it("should return false if no deprecation indicators", () => {
      const node = {
        ...mockSyntaxNode,
        children: [],
        parent: { ...mockSyntaxNode, type: "not_export" },
      };
      expect(strategy.detectDeprecated(node)).toBe(false);
    });

    it("should detect deprecated from comment", () => {
      const comment = { ...mockSyntaxNode, type: "comment", text: "/* @deprecated */" };
      const node = {
        ...mockSyntaxNode,
        children: [],
        parent: { ...mockSyntaxNode, type: "export_statement", previousNamedSibling: comment },
      };
      expect(strategy.detectDeprecated(node)).toBe(true);
    });

    it("should detect deprecated from decorator", () => {
      const decorator = { ...mockSyntaxNode, type: "decorator", text: "@Deprecated" };
      const node = { ...mockSyntaxNode, children: [decorator] };
      expect(strategy.detectDeprecated(node)).toBe(true);
    });
  });

  describe("extractClassRelationships", () => {
    it("should add extends relationship", () => {
      const addRel = jest.fn();
      const typeNode = { ...mockSyntaxNode, type: "type_identifier", text: "BaseClass" };
      const extendsClause = { ...mockSyntaxNode, type: "extends_clause", children: [typeNode] };
      const heritage = { ...mockSyntaxNode, type: "class_heritage", children: [extendsClause] };
      const node = {
        ...mockSyntaxNode,
        children: [heritage],
        startPosition: { row: 10, column: 0 },
      };
      const classSymbol = { id: "MyClass" } as CodeSymbol;
      const file = "test.ts";

      strategy.extractClassRelationships(node, classSymbol, addRel, file);

      expect(addRel).toHaveBeenCalledWith("MyClass", "BaseClass", "inherits", "test.ts", 11);
    });

    it("should add implements relationships", () => {
      const addRel = jest.fn();
      const type1 = { ...mockSyntaxNode, type: "type_identifier", text: "Interface1" };
      const type2 = { ...mockSyntaxNode, type: "type_identifier", text: "Interface2" };
      const implClause = { ...mockSyntaxNode, type: "implements_clause", children: [type1, type2] };
      const heritage = { ...mockSyntaxNode, type: "class_heritage", children: [implClause] };
      const node = {
        ...mockSyntaxNode,
        children: [heritage],
        startPosition: { row: 10, column: 0 },
      };
      const classSymbol = { id: "MyClass" } as CodeSymbol;
      const file = "test.ts";

      strategy.extractClassRelationships(node, classSymbol, addRel, file);

      expect(addRel).toHaveBeenCalledWith("MyClass", "Interface1", "implements", "test.ts", 11);
      expect(addRel).toHaveBeenCalledWith("MyClass", "Interface2", "implements", "test.ts", 11);
    });
  });

  describe("extractInstantiationRelationships", () => {
    it("should not add relationship if not new_expression", () => {
      const addRel = jest.fn();
      const node = { ...mockSyntaxNode, type: "other" };
      const symsInFile: CodeSymbol[] = [];
      const file = "test.ts";

      strategy.extractInstantiationRelationships(node, symsInFile, addRel, file);

      expect(addRel).not.toHaveBeenCalled();
    });

    it("should add instantiates relationship", () => {
      const addRel = jest.fn();
      const constructorNode = { ...mockSyntaxNode, type: "identifier", text: "MyClass" };
      const node = {
        ...mockSyntaxNode,
        type: "new_expression",
        childForFieldName: jest.fn().mockReturnValue(constructorNode as Parser.SyntaxNode),
        startPosition: { row: 5, column: 0 },
      };
      const enclosingSymbol = { id: "method1", startLine: 1, endLine: 20 } as CodeSymbol;
      const symsInFile = [enclosingSymbol];
      const file = "test.ts";

      strategy.extractInstantiationRelationships(node, symsInFile, addRel, file);

      expect(addRel).toHaveBeenCalledWith("method1", "MyClass", "instantiates", "test.ts", 6);
    });
  });

  describe("extractImportRelationships", () => {
    it("should not add relationship if not import_statement", () => {
      const addRel = jest.fn();
      const node = { ...mockSyntaxNode, type: "other" };
      const symsInFile: CodeSymbol[] = [];
      const file = "test.ts";

      strategy.extractImportRelationships(node, symsInFile, addRel, file);

      expect(addRel).not.toHaveBeenCalled();
    });

    it("should add uses relationships for named imports", () => {
      const addRel = jest.fn();
      const nameNode = { ...mockSyntaxNode, text: "MyImport" };
      const spec = {
        ...mockSyntaxNode,
        type: "import_specifier",
        childForFieldName: jest.fn().mockReturnValue(nameNode as Parser.SyntaxNode),
      };
      const importClause = {
        ...mockSyntaxNode,
        type: "import_clause",
        descendantsOfType: jest.fn().mockReturnValue([spec as Parser.SyntaxNode]),
      };
      const node = {
        ...mockSyntaxNode,
        type: "import_statement",
        children: [importClause as Parser.SyntaxNode],
        startPosition: { row: 1, column: 0 },
      };
      const sourceSymbol = { id: "module", startLine: 1, endLine: 10 } as CodeSymbol;
      const symsInFile = [sourceSymbol];
      const file = "test.ts";

      strategy.extractImportRelationships(node, symsInFile, addRel, file);

      expect(addRel).toHaveBeenCalledWith("module", "MyImport", "uses", "test.ts", 2);
    });
  });

  describe("extractCallRelationships", () => {
    it("should not add relationship if not call_expression", () => {
      const addRel = jest.fn();
      const node = { ...mockSyntaxNode, type: "other" };
      const symsInFile: CodeSymbol[] = [];
      const file = "test.ts";

      strategy.extractCallRelationships(node, symsInFile, addRel, file);

      expect(addRel).not.toHaveBeenCalled();
    });

    it("should add calls relationship for local function", () => {
      const addRel = jest.fn();
      const functionNode = { ...mockSyntaxNode, type: "identifier", text: "myFunction" };
      const node = {
        ...mockSyntaxNode,
        type: "call_expression",
        childForFieldName: jest.fn().mockReturnValue(functionNode as Parser.SyntaxNode),
        startPosition: { row: 10, column: 0 },
      };
      const enclosingSymbol = { id: "method1", startLine: 1, endLine: 20 } as CodeSymbol;
      // Include the target function as a local function in the same file
      const localFunction = {
        id: "func1",
        name: "myFunction",
        kind: "function",
        startLine: 25,
        endLine: 30,
      } as CodeSymbol;
      const symsInFile = [enclosingSymbol, localFunction];
      const file = "test.ts";

      strategy.extractCallRelationships(node, symsInFile, addRel, file);

      expect(addRel).toHaveBeenCalledWith("method1", "myFunction", "calls", "test.ts", 11);
    });

    it("should add calls relationship for imported function", () => {
      const addRel = jest.fn();
      const functionNode = { ...mockSyntaxNode, type: "identifier", text: "importedFunc" };
      const node = {
        ...mockSyntaxNode,
        type: "call_expression",
        childForFieldName: jest.fn().mockReturnValue(functionNode as Parser.SyntaxNode),
        startPosition: { row: 10, column: 0 },
      };
      const enclosingSymbol = { id: "method1", startLine: 1, endLine: 20 } as CodeSymbol;
      const symsInFile = [enclosingSymbol];
      const file = "test.ts";
      // Provide resolution context with imports
      const ctx = { imports: new Map([["importedFunc", "./utils::importedFunc"]]) };

      strategy.extractCallRelationships(node, symsInFile, addRel, file, ctx);

      expect(addRel).toHaveBeenCalledWith(
        "method1",
        "./utils::importedFunc::importedFunc",
        "calls",
        "test.ts",
        11,
      );
    });

    it("should NOT add calls relationship for unknown function (prevents false positives)", () => {
      const addRel = jest.fn();
      const functionNode = { ...mockSyntaxNode, type: "identifier", text: "unknownFunction" };
      const node = {
        ...mockSyntaxNode,
        type: "call_expression",
        childForFieldName: jest.fn().mockReturnValue(functionNode as Parser.SyntaxNode),
        startPosition: { row: 10, column: 0 },
      };
      const enclosingSymbol = { id: "method1", startLine: 1, endLine: 20 } as CodeSymbol;
      const symsInFile = [enclosingSymbol];
      const file = "test.ts";

      strategy.extractCallRelationships(node, symsInFile, addRel, file);

      // Should NOT create relationship for unknown function
      expect(addRel).not.toHaveBeenCalled();
    });
  });
});
