import { jest } from "@jest/globals";

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
};

jest.mock("tree-sitter", () => ({
  __esModule: true,
  default: jest.fn(),
}));

import { DefaultStrategy } from "../../src/indexer/languages/defaultStrategy.js";
import { PhpStrategy } from "../../src/indexer/languages/phpStrategy.js";
import type { CodeSymbol } from "../../src/indexer/symbol.types.js";

describe("Language Strategies", () => {
  describe("DefaultStrategy", () => {
    let strategy: DefaultStrategy;

    beforeEach(() => {
      strategy = new DefaultStrategy();
    });

    it("extractNamespace returns undefined", () => {
      const result = strategy.extractNamespace(mockSyntaxNode as any);
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
      const result = strategy.extractExtends(mockSyntaxNode as any);
      expect(result).toBeUndefined();
    });

    it("extractImplements returns undefined", () => {
      const result = strategy.extractImplements(mockSyntaxNode as any);
      expect(result).toBeUndefined();
    });

    it("extractTraits returns undefined", () => {
      const result = strategy.extractTraits(mockSyntaxNode as any);
      expect(result).toBeUndefined();
    });

    it("extractVisibility returns undefined for no modifier", () => {
      const result = strategy.extractVisibility(mockSyntaxNode as any);
      expect(result).toBeUndefined();
    });

    it("extractVisibility returns visibility for public modifier", () => {
      const nodeWithModifier = {
        ...mockSyntaxNode,
        children: [{ type: "accessibility_modifier", text: "public" }],
      };
      const result = strategy.extractVisibility(nodeWithModifier as any);
      expect(result).toBe("public");
    });

    it("refineKind returns the same kind", () => {
      const result = strategy.refineKind("class", "Test");
      expect(result).toBe("class");
    });

    it("detectDeprecated returns false for no comment", () => {
      const result = strategy.detectDeprecated(mockSyntaxNode as any);
      expect(result).toBe(false);
    });

    it("detectDeprecated returns true for deprecated comment", () => {
      const nodeWithComment = {
        ...mockSyntaxNode,
        previousNamedSibling: { type: "comment", text: "@deprecated This is deprecated" },
      };
      const result = strategy.detectDeprecated(nodeWithComment as any);
      expect(result).toBe(true);
    });

    it("extractClassRelationships does nothing", () => {
      const addRel = jest.fn();
      strategy.extractClassRelationships(
        mockSyntaxNode as any,
        {} as CodeSymbol,
        addRel,
        "test.ts",
      );
      expect(addRel).not.toHaveBeenCalled();
    });

    it("extractInstantiationRelationships does nothing", () => {
      const addRel = jest.fn();
      strategy.extractInstantiationRelationships(mockSyntaxNode as any, [], addRel, "test.ts");
      expect(addRel).not.toHaveBeenCalled();
    });

    it("extractImportRelationships does nothing", () => {
      const addRel = jest.fn();
      strategy.extractImportRelationships(mockSyntaxNode as any, [], addRel, "test.ts");
      expect(addRel).not.toHaveBeenCalled();
    });

    it("extractCallRelationships does nothing", () => {
      const addRel = jest.fn();
      strategy.extractCallRelationships(mockSyntaxNode as any, [], addRel, "test.ts");
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
      };
      const result = strategy.extractNamespace(rootWithNamespace as any);
      expect(result).toBe("App\\Models");
    });

    it("extractNamespace returns undefined when no namespace", () => {
      const result = strategy.extractNamespace(mockSyntaxNode as any);
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

    it("extractExtends returns base class name", () => {
      const nodeWithExtends = {
        ...mockSyntaxNode,
        children: [
          {
            type: "base_clause",
            children: [{ type: "qualified_name", text: "BaseClass" }],
          },
        ],
      };
      const result = strategy.extractExtends(nodeWithExtends as any);
      expect(result).toBe("BaseClass");
    });

    it("extractExtends returns undefined when no base clause", () => {
      const result = strategy.extractExtends(mockSyntaxNode as any);
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
      };
      const result = strategy.extractImplements(nodeWithImplements as any);
      expect(result).toEqual(["Interface1", "Namespace\\Interface2"]);
    });

    it("extractImplements returns undefined when no interfaces", () => {
      const result = strategy.extractImplements(mockSyntaxNode as any);
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
      };
      const result = strategy.extractTraits(nodeWithTraits as any);
      expect(result).toEqual(["Trait1", "Namespace\\Trait2"]);
    });

    it("extractTraits returns undefined when no traits", () => {
      const result = strategy.extractTraits(mockSyntaxNode as any);
      expect(result).toBeUndefined();
    });
  });
});
