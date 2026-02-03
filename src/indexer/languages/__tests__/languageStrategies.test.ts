import { jest } from "@jest/globals";
import type Parser from "tree-sitter";

// Mock tree-sitter
const mockSyntaxNode = {
  type: "mock",
  text: "mock",
  children: [],
  childForFieldName: jest.fn(),
  previousNamedSibling: null,
  find: jest.fn(),
  filter: jest.fn(),
  map: jest.fn(),
} as unknown as Parser.SyntaxNode;

jest.mock("tree-sitter", () => ({
  __esModule: true,
  default: jest.fn(),
}));

import { DefaultStrategy } from "../defaultStrategy.js";
import { PhpStrategy } from "../phpStrategy.js";
import type { CodeSymbol } from "../../symbol.types.js";

describe("Language Strategies", () => {
  describe("DefaultStrategy", () => {
    let strategy: DefaultStrategy;

    beforeEach(() => {
      strategy = new DefaultStrategy();
    });

    it("extractNamespace returns undefined", () => {
      const result = strategy.extractNamespace(mockSyntaxNode);
      expect(result).toBeUndefined();
    });

    it("buildQualifiedName builds name without parent", () => {
      const result = strategy.buildQualifiedName("TestClass");
      expect(result).toBe("TestClass");
    });

    it("buildQualifiedName builds name with parent", () => {
      const result = strategy.buildQualifiedName("method", "TestClass");
      expect(result).toBe("TestClass.method");
    });

    it("extractExtends returns undefined", () => {
      const result = strategy.extractExtends(mockSyntaxNode);
      expect(result).toBeUndefined();
    });

    it("extractImplements returns undefined", () => {
      const result = strategy.extractImplements(mockSyntaxNode);
      expect(result).toBeUndefined();
    });

    it("extractTraits returns undefined", () => {
      const result = strategy.extractTraits(mockSyntaxNode);
      expect(result).toBeUndefined();
    });

    it("extractVisibility returns undefined for no modifier", () => {
      const result = strategy.extractVisibility(mockSyntaxNode);
      expect(result).toBeUndefined();
    });

    it("extractVisibility returns visibility for public modifier", () => {
      const nodeWithModifier = {
        ...mockSyntaxNode,
        children: [{ type: "accessibility_modifier", text: "public" }],
      } as unknown as Parser.SyntaxNode;
      const result = strategy.extractVisibility(nodeWithModifier);
      expect(result).toBe("public");
    });

    it("refineKind returns the same kind", () => {
      const result = strategy.refineKind("class", "Test");
      expect(result).toBe("class");
    });

    it("detectDeprecated returns false for no comment", () => {
      const result = strategy.detectDeprecated(mockSyntaxNode);
      expect(result).toBe(false);
    });

    it("detectDeprecated returns true for deprecated comment", () => {
      const nodeWithComment = {
        ...mockSyntaxNode,
        previousNamedSibling: { type: "comment", text: "@deprecated This is deprecated" },
      } as unknown as Parser.SyntaxNode;
      const result = strategy.detectDeprecated(nodeWithComment);
      expect(result).toBe(true);
    });

    it("extractClassRelationships does nothing", () => {
      const addRel = jest.fn();
      strategy.extractClassRelationships(mockSyntaxNode, {} as CodeSymbol, addRel, "test.ts");
      expect(addRel).not.toHaveBeenCalled();
    });

    it("extractInstantiationRelationships does nothing", () => {
      const addRel = jest.fn();
      strategy.extractInstantiationRelationships(mockSyntaxNode, [], addRel, "test.ts");
      expect(addRel).not.toHaveBeenCalled();
    });

    it("extractImportRelationships does nothing", () => {
      const addRel = jest.fn();
      strategy.extractImportRelationships(mockSyntaxNode, [], addRel, "test.ts");
      expect(addRel).not.toHaveBeenCalled();
    });

    it("extractCallRelationships does nothing", () => {
      const addRel = jest.fn();
      strategy.extractCallRelationships(mockSyntaxNode, [], addRel, "test.ts");
      expect(addRel).not.toHaveBeenCalled();
    });
  });

  describe("PhpStrategy", () => {
    let strategy: PhpStrategy;

    beforeEach(() => {
      strategy = new PhpStrategy();
    });

    it("extractNamespace returns namespace name", () => {
      const rootWithNamespace = {
        ...mockSyntaxNode,
        children: [
          {
            type: "namespace_definition",
            childForFieldName: jest.fn().mockReturnValue({ text: "App\\Models" }),
          },
        ],
      } as unknown as Parser.SyntaxNode;
      const result = strategy.extractNamespace(rootWithNamespace);
      expect(result).toBe("App\\Models");
    });

    it("extractNamespace returns undefined when no namespace", () => {
      const result = strategy.extractNamespace(mockSyntaxNode);
      expect(result).toBeUndefined();
    });

    it("buildQualifiedName builds name with namespace", () => {
      const result = strategy.buildQualifiedName("User", undefined, "App\\Models");
      expect(result).toBe("App\\Models\\User");
    });

    it("buildQualifiedName builds name with parent", () => {
      const result = strategy.buildQualifiedName("method", "User");
      expect(result).toBe("User.method");
    });

    it("buildQualifiedName returns name when no parent or namespace", () => {
      const result = strategy.buildQualifiedName("SimpleName");
      expect(result).toBe("SimpleName");
    });

    it("extractExtends returns base class name", () => {
      const nodeWithExtends = {
        ...mockSyntaxNode,
        children: [
          {
            type: "base_clause",
            children: [{ type: "qualified_name", text: "BaseClass" }],
          },
        ],
      } as unknown as Parser.SyntaxNode;
      const result = strategy.extractExtends(nodeWithExtends);
      expect(result).toBe("BaseClass");
    });

    it("extractExtends returns undefined when no base clause", () => {
      const result = strategy.extractExtends(mockSyntaxNode);
      expect(result).toBeUndefined();
    });

    it("extractImplements returns interface names", () => {
      const nodeWithImplements = {
        ...mockSyntaxNode,
        children: [
          {
            type: "class_interface_clause",
            children: [
              { type: "name", text: "Interface1" },
              { type: "qualified_name", text: "Namespace\\Interface2" },
            ],
          },
        ],
      } as unknown as Parser.SyntaxNode;
      const result = strategy.extractImplements(nodeWithImplements);
      expect(result).toEqual(["Interface1", "Namespace\\Interface2"]);
    });

    it("extractImplements returns undefined when no interfaces", () => {
      const result = strategy.extractImplements(mockSyntaxNode);
      expect(result).toBeUndefined();
    });

    it("extractTraits returns trait names", () => {
      const nodeWithTraits = {
        ...mockSyntaxNode,
        children: [
          {
            type: "declaration_list",
            children: [
              {
                type: "use_declaration",
                children: [
                  { type: "name", text: "Trait1" },
                  { type: "qualified_name", text: "Namespace\\Trait2" },
                ],
              },
            ],
          },
        ],
      } as unknown as Parser.SyntaxNode;
      const result = strategy.extractTraits(nodeWithTraits);
      expect(result).toEqual(["Trait1", "Namespace\\Trait2"]);
    });

    it("extractTraits returns undefined when no traits", () => {
      const result = strategy.extractTraits(mockSyntaxNode);
      expect(result).toBeUndefined();
    });

    it("extractVisibility returns public visibility", () => {
      const nodeWithVisibility = {
        ...mockSyntaxNode,
        children: [
          {
            type: "visibility_modifier",
            text: "public",
          },
        ],
      } as unknown as Parser.SyntaxNode;
      const result = strategy.extractVisibility(nodeWithVisibility);
      expect(result).toBe("public");
    });

    it("extractVisibility returns private visibility", () => {
      const nodeWithVisibility = {
        ...mockSyntaxNode,
        children: [
          {
            type: "visibility_modifier",
            text: "private",
          },
        ],
      } as unknown as Parser.SyntaxNode;
      const result = strategy.extractVisibility(nodeWithVisibility);
      expect(result).toBe("private");
    });

    it("extractVisibility returns protected visibility", () => {
      const nodeWithVisibility = {
        ...mockSyntaxNode,
        children: [
          {
            type: "visibility_modifier",
            text: "protected",
          },
        ],
      } as unknown as Parser.SyntaxNode;
      const result = strategy.extractVisibility(nodeWithVisibility);
      expect(result).toBe("protected");
    });

    it("extractVisibility returns undefined for invalid modifier", () => {
      const nodeWithVisibility = {
        ...mockSyntaxNode,
        children: [
          {
            type: "visibility_modifier",
            text: "invalid",
          },
        ],
      } as unknown as Parser.SyntaxNode;
      const result = strategy.extractVisibility(nodeWithVisibility);
      expect(result).toBeUndefined();
    });

    it("extractVisibility returns undefined when no modifier", () => {
      const result = strategy.extractVisibility(mockSyntaxNode);
      expect(result).toBeUndefined();
    });

    it("refineKind returns event for extends containing event", () => {
      const result = strategy.refineKind("class", "SomeClass", "SomeEvent");
      expect(result).toBe("event");
    });

    it("refineKind returns listener for class ending with Listener", () => {
      const result = strategy.refineKind("class", "EventListener");
      expect(result).toBe("listener");
    });

    it("refineKind returns handler for class ending with Handler", () => {
      const result = strategy.refineKind("class", "EventHandler");
      expect(result).toBe("handler");
    });

    it("refineKind returns controller for class ending with Controller", () => {
      const result = strategy.refineKind("class", "UserController");
      expect(result).toBe("controller");
    });

    it("refineKind returns factory for class ending with Factory", () => {
      const result = strategy.refineKind("class", "UserFactory");
      expect(result).toBe("factory");
    });

    it("refineKind returns middleware for class ending with Middleware", () => {
      const result = strategy.refineKind("class", "AuthMiddleware");
      expect(result).toBe("middleware");
    });

    it("refineKind returns provider for class ending with Provider", () => {
      const result = strategy.refineKind("class", "ServiceProvider");
      expect(result).toBe("provider");
    });

    it("refineKind returns dto for class ending with Request", () => {
      const result = strategy.refineKind("class", "UserRequest");
      expect(result).toBe("dto");
    });

    it("refineKind returns entity for class ending with Model", () => {
      const result = strategy.refineKind("class", "UserModel");
      expect(result).toBe("entity");
    });

    it("refineKind returns command for class ending with Command", () => {
      const result = strategy.refineKind("class", "CreateUserCommand");
      expect(result).toBe("command");
    });

    it("refineKind returns query for class ending with Query", () => {
      const result = strategy.refineKind("class", "GetUserQuery");
      expect(result).toBe("query");
    });

    it("refineKind returns abstract_class when no match", () => {
      const result = strategy.refineKind("abstract_class", "SomeAbstractClass");
      expect(result).toBe("abstract_class");
    });

    it("refineKind returns service for class ending with Service", () => {
      const result = strategy.refineKind("class", "OrderService");
      expect(result).toBe("service");
    });

    it("refineKind returns repository for class ending with Repository", () => {
      const result = strategy.refineKind("class", "UserRepository");
      expect(result).toBe("repository");
    });

    it("refineKind returns dto for class ending with DTO", () => {
      const result = strategy.refineKind("class", "UserDTO");
      expect(result).toBe("dto");
    });

    it("refineKind returns entity for class ending with Entity", () => {
      const result = strategy.refineKind("class", "UserEntity");
      expect(result).toBe("entity");
    });

    it("refineKind returns listener for implements listener", () => {
      const result = strategy.refineKind("class", "SomeClass", undefined, ["EventListener"]);
      expect(result).toBe("listener");
    });

    it("refineKind returns original kind when not class or abstract_class", () => {
      const result = strategy.refineKind("function", "someFunction");
      expect(result).toBe("function");
    });

    it("detectDeprecated returns true for deprecated comment", () => {
      const nodeWithComment = {
        ...mockSyntaxNode,
        previousNamedSibling: { type: "comment", text: "@deprecated This is deprecated" },
      } as unknown as Parser.SyntaxNode;
      const result = strategy.detectDeprecated(nodeWithComment);
      expect(result).toBe(true);
    });

    it("detectDeprecated returns false for no comment", () => {
      const result = strategy.detectDeprecated(mockSyntaxNode);
      expect(result).toBe(false);
    });

    it("detectDeprecated returns false for non-deprecated comment", () => {
      const nodeWithComment = {
        ...mockSyntaxNode,
        previousNamedSibling: { type: "comment", text: "Some comment" },
      } as unknown as Parser.SyntaxNode;
      const result = strategy.detectDeprecated(nodeWithComment);
      expect(result).toBe(false);
    });

    it("extractClassRelationships extracts extends relationship with name", () => {
      const classSymbol = { id: "class1", name: "TestClass" } as CodeSymbol;
      const nodeWithExtends = {
        ...mockSyntaxNode,
        children: [
          {
            type: "base_clause",
            children: [{ type: "name", text: "BaseClass" }],
          },
        ],
        startPosition: { row: 10 },
      } as unknown as Parser.SyntaxNode;
      const addRel = jest.fn();
      strategy.extractClassRelationships(nodeWithExtends, classSymbol, addRel, "test.php");
      expect(addRel).toHaveBeenCalledWith(
        "class1",
        "BaseClass",
        "inherits",
        "test.php",
        11,
        undefined,
      );
    });

    it("extractClassRelationships extracts implements relationships", () => {
      const classSymbol = { id: "class1", name: "TestClass" } as CodeSymbol;
      const nodeWithImplements = {
        ...mockSyntaxNode,
        children: [
          {
            type: "class_interface_clause",
            children: [
              { type: "name", text: "Interface1" },
              { type: "qualified_name", text: "Namespace\\Interface2" },
            ],
          },
        ],
        startPosition: { row: 10 },
      } as unknown as Parser.SyntaxNode;
      const addRel = jest.fn();
      strategy.extractClassRelationships(nodeWithImplements, classSymbol, addRel, "test.php");
      expect(addRel).toHaveBeenCalledWith(
        "class1",
        "Interface1",
        "implements",
        "test.php",
        11,
        undefined,
      );
      expect(addRel).toHaveBeenCalledWith(
        "class1",
        "Namespace\\Interface2",
        "implements",
        "test.php",
        11,
        undefined,
      );
    });

    it("extractClassRelationships extracts trait relationships", () => {
      const classSymbol = { id: "class1", name: "TestClass" } as CodeSymbol;
      const nodeWithTraits = {
        ...mockSyntaxNode,
        children: [
          {
            type: "declaration_list",
            children: [
              {
                type: "use_declaration",
                children: [
                  { type: "name", text: "Trait1" },
                  { type: "qualified_name", text: "Namespace\\Trait2" },
                ],
                startPosition: { row: 12 },
              },
            ],
          },
        ],
        startPosition: { row: 10 },
      } as unknown as Parser.SyntaxNode;
      const addRel = jest.fn();
      strategy.extractClassRelationships(nodeWithTraits, classSymbol, addRel, "test.php");
      expect(addRel).toHaveBeenCalledWith(
        "class1",
        "Trait1",
        "uses_trait",
        "test.php",
        13,
        undefined,
      );
      expect(addRel).toHaveBeenCalledWith(
        "class1",
        "Namespace\\Trait2",
        "uses_trait",
        "test.php",
        13,
        undefined,
      );
    });

    it("extractInstantiationRelationships extracts instantiates for object_creation_expression", () => {
      const symsInFile = [
        { id: "method1", name: "create", startLine: 5, endLine: 15, parent: "class1" },
      ] as CodeSymbol[];
      const node = {
        type: "object_creation_expression",
        children: [{ type: "name", text: "SomeClass" }],
        startPosition: { row: 10 },
      } as unknown as Parser.SyntaxNode;
      const addRel = jest.fn();
      strategy.extractInstantiationRelationships(node, symsInFile, addRel, "test.php");
      expect(addRel).toHaveBeenCalledWith(
        "method1",
        "SomeClass",
        "instantiates",
        "test.php",
        11,
        undefined,
      );
    });

    it("extractInstantiationRelationships extracts dispatches for scoped_call_expression", () => {
      const symsInFile = [
        { id: "method1", name: "dispatchEvent", startLine: 5, endLine: 15, parent: "class1" },
      ] as CodeSymbol[];
      const node = {
        type: "scoped_call_expression",
        children: [{ type: "name", text: "EventDispatcher" }],
        childForFieldName: jest.fn().mockReturnValue({ text: "dispatch" }),
        startPosition: { row: 10 },
      } as unknown as Parser.SyntaxNode;
      const addRel = jest.fn();
      strategy.extractInstantiationRelationships(node, symsInFile, addRel, "test.php");
      expect(addRel).toHaveBeenCalledWith(
        "method1",
        "EventDispatcher",
        "dispatches",
        "test.php",
        11,
        undefined,
      );
    });

    it("extractEventListenerRelationships extracts listens_to for handle method with named_type", () => {
      const symsInFile = [
        { id: "class1", name: "EventListener", startLine: 1, endLine: 20, parent: undefined },
      ] as CodeSymbol[];
      const node = {
        type: "method_declaration",
        childForFieldName: jest.fn().mockReturnValue({ text: "handle" }),
        children: [
          {
            type: "formal_parameters",
            children: [
              {
                type: "simple_parameter",
                children: [{ type: "qualified_name", text: "App\\Events\\OrderEvent" }],
              },
            ],
          },
        ],
        startPosition: { row: 10 },
        endPosition: { row: 15 },
      } as unknown as Parser.SyntaxNode;
      const addRel = jest.fn();
      strategy.extractEventListenerRelationships(node, symsInFile, addRel, "test.php");
      // Now passes full qualified name for proper resolution
      expect(addRel).toHaveBeenCalledWith(
        "class1",
        "App\\Events\\OrderEvent",
        "listens_to",
        "test.php",
        11,
        undefined,
      );
    });

    it("extractEventListenerRelationships handles union_type", () => {
      const symsInFile = [
        { id: "class1", name: "EventListener", startLine: 1, endLine: 20, parent: undefined },
      ] as CodeSymbol[];
      const node = {
        type: "method_declaration",
        childForFieldName: jest.fn().mockReturnValue({ text: "handle" }),
        children: [
          {
            type: "formal_parameters",
            children: [
              {
                type: "simple_parameter",
                children: [
                  {
                    type: "union_type",
                    children: [
                      { type: "named_type", text: "OrderEvent" },
                      { type: "named_type", text: "UserEvent" },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        startPosition: { row: 10 },
        endPosition: { row: 15 },
      } as unknown as Parser.SyntaxNode;
      const addRel = jest.fn();
      strategy.extractEventListenerRelationships(node, symsInFile, addRel, "test.php");
      expect(addRel).toHaveBeenCalledWith(
        "class1",
        "OrderEvent",
        "listens_to",
        "test.php",
        11,
        undefined,
      );
    });

    it("extractImportRelationships extracts uses for namespace_use_declaration", () => {
      const symsInFile = [
        { id: "class1", name: "TestClass", startLine: 1, endLine: 20, parent: undefined },
      ] as CodeSymbol[];
      const node = {
        type: "namespace_use_declaration",
        children: [
          {
            type: "namespace_use_clause",
            children: [{ type: "qualified_name", text: "App\\Models\\User" }],
          },
        ],
        startPosition: { row: 5 },
      } as unknown as Parser.SyntaxNode;
      const addRel = jest.fn();
      strategy.extractImportRelationships(node, symsInFile, addRel, "test.php");
      // Now passes full qualified name for proper resolution
      expect(addRel).toHaveBeenCalledWith(
        "class1",
        "App\\Models\\User",
        "uses",
        "test.php",
        6,
        undefined,
      );
    });

    it("extractCallRelationships extracts calls for local function", () => {
      const symsInFile = [
        { id: "method1", name: "testMethod", kind: "method", startLine: 5, endLine: 15, parent: "class1" },
        { id: "func1", name: "someFunction", kind: "function", startLine: 1, endLine: 3 },
      ] as CodeSymbol[];
      const node = {
        type: "function_call_expression",
        childForFieldName: jest.fn().mockReturnValue({ type: "name", text: "someFunction" }),
        startPosition: { row: 10 },
      } as unknown as Parser.SyntaxNode;
      const addRel = jest.fn();
      strategy.extractCallRelationships(node, symsInFile, addRel, "test.php");
      expect(addRel).toHaveBeenCalledWith(
        "method1",
        "someFunction",
        "calls",
        "test.php",
        11,
        undefined,
      );
    });

    it("extractCallRelationships does NOT create relationship for unknown function (prevents false positives)", () => {
      const symsInFile = [
        { id: "method1", name: "testMethod", kind: "method", startLine: 5, endLine: 15, parent: "class1" },
      ] as CodeSymbol[];
      const node = {
        type: "function_call_expression",
        childForFieldName: jest.fn().mockReturnValue({ type: "name", text: "unknownFunction" }),
        startPosition: { row: 10 },
      } as unknown as Parser.SyntaxNode;
      const addRel = jest.fn();
      strategy.extractCallRelationships(node, symsInFile, addRel, "test.php");
      // Should NOT create relationship for unknown function
      expect(addRel).not.toHaveBeenCalled();
    });

    it("extractCallRelationships extracts uses for imported class via member_access_expression", () => {
      const symsInFile = [
        { id: "method1", name: "testMethod", kind: "method", startLine: 5, endLine: 15, parent: "class1" },
      ] as CodeSymbol[];
      const node = {
        type: "member_access_expression",
        childForFieldName: jest.fn().mockReturnValue({ type: "name", text: "SomeClass" }),
        startPosition: { row: 10 },
      } as unknown as Parser.SyntaxNode;
      const addRel = jest.fn();
      // Pass resolution context with imported class
      const ctx = { imports: new Map([["SomeClass", "App\\Services\\SomeClass"]]) };
      strategy.extractCallRelationships(node, symsInFile, addRel, "test.php", ctx);
      expect(addRel).toHaveBeenCalledWith(
        "method1",
        "App\\Services\\SomeClass",
        "uses",
        "test.php",
        11,
        ctx,
      );
    });

    it("extractCallRelationships does NOT create uses for unknown class (prevents false positives)", () => {
      const symsInFile = [
        { id: "method1", name: "testMethod", kind: "method", startLine: 5, endLine: 15, parent: "class1" },
      ] as CodeSymbol[];
      const node = {
        type: "member_access_expression",
        childForFieldName: jest.fn().mockReturnValue({ type: "name", text: "UnknownClass" }),
        startPosition: { row: 10 },
      } as unknown as Parser.SyntaxNode;
      const addRel = jest.fn();
      strategy.extractCallRelationships(node, symsInFile, addRel, "test.php");
      // Should NOT create relationship for unknown class
      expect(addRel).not.toHaveBeenCalled();
    });

    it("extractCallRelationships skips variable access", () => {
      const symsInFile = [
        { id: "method1", name: "testMethod", startLine: 5, endLine: 15, parent: "class1" },
      ] as CodeSymbol[];
      const node = {
        type: "member_access_expression",
        childForFieldName: jest.fn().mockReturnValue({ type: "variable_name", text: "$this" }),
        startPosition: { row: 10 },
      } as unknown as Parser.SyntaxNode;
      const addRel = jest.fn();
      strategy.extractCallRelationships(node, symsInFile, addRel, "test.php");
      expect(addRel).not.toHaveBeenCalled();
    });
  });
});
