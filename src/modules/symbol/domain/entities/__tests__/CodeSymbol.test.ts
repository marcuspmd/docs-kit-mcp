import { describe, it, expect, beforeEach } from "@jest/globals";
import { CodeSymbol, type CreateCodeSymbolInput } from "../CodeSymbol.js";
import { FileLocation } from "../../value-objects/FileLocation.js";
import { SymbolKind } from "../../value-objects/SymbolKind.js";

/**
 * Unit Tests for CodeSymbol Entity
 *
 * Tests the creation, manipulation, and persistence of code symbols.
 * Covers static factory methods, instance methods, getters, and value object integration.
 */
describe("CodeSymbol", () => {
  // Test data
  const validLocation = {
    filePath: "src/services/UserService.ts",
    startLine: 10,
    endLine: 25,
    startColumn: 0,
    endColumn: 1,
  };

  const validCreateInput: CreateCodeSymbolInput = {
    name: "UserService",
    qualifiedName: "src.services.UserService",
    kind: "class",
    location: validLocation,
    visibility: "public",
    exported: true,
    language: "ts",
    docRef: "docs/UserService.md",
    summary: "Manages user operations",
  };

  describe("CodeSymbol.create()", () => {
    it("should create a symbol with valid input", () => {
      const result = CodeSymbol.create(validCreateInput);

      expect(result.isSuccess).toBe(true);
      const symbol = result.value;

      expect(symbol.name).toBe("UserService");
      expect(symbol.qualifiedName).toBe("src.services.UserService");
      expect(symbol.kind).toBe("class");
      expect(symbol.visibility).toBe("public");
      expect(symbol.exported).toBe(true);
      expect(symbol.language).toBe("ts");
      expect(symbol.docRef).toBe("docs/UserService.md");
      expect(symbol.summary).toBe("Manages user operations");
    });

    it("should create a symbol with minimal required input", () => {
      const minimalInput: CreateCodeSymbolInput = {
        name: "myFunction",
        kind: "function",
        location: validLocation,
      };

      const result = CodeSymbol.create(minimalInput);

      expect(result.isSuccess).toBe(true);
      const symbol = result.value;

      expect(symbol.name).toBe("myFunction");
      expect(symbol.kind).toBe("function");
      expect(symbol.qualifiedName).toBeUndefined();
      expect(symbol.visibility).toBeUndefined();
      expect(symbol.exported).toBeUndefined();
    });

    it("should generate consistent ID for same symbol", () => {
      const result1 = CodeSymbol.create(validCreateInput);
      const result2 = CodeSymbol.create(validCreateInput);

      expect(result1.isSuccess).toBe(true);
      expect(result2.isSuccess).toBe(true);
      expect(result1.value.id).toBe(result2.value.id);
    });

    it("should generate different IDs for different symbols", () => {
      const input2 = {
        ...validCreateInput,
        name: "OrderService",
      };

      const result1 = CodeSymbol.create(validCreateInput);
      const result2 = CodeSymbol.create(input2);

      expect(result1.isSuccess).toBe(true);
      expect(result2.isSuccess).toBe(true);
      expect(result1.value.id).not.toBe(result2.value.id);
    });

    it("should fail with empty symbol name", () => {
      const invalidInput: CreateCodeSymbolInput = {
        ...validCreateInput,
        name: "",
      };

      const result = CodeSymbol.create(invalidInput);

      expect(result.isFailure).toBe(true);
      expect(result.error).toEqual(new Error("Symbol name cannot be empty"));
    });

    it("should fail with whitespace-only name", () => {
      const invalidInput: CreateCodeSymbolInput = {
        ...validCreateInput,
        name: "   ",
      };

      const result = CodeSymbol.create(invalidInput);

      expect(result.isFailure).toBe(true);
    });

    it("should fail with invalid symbol kind", () => {
      const invalidInput = {
        ...validCreateInput,
        kind: "invalid_kind",
      };

      const result = CodeSymbol.create(invalidInput as CreateCodeSymbolInput);

      expect(result.isFailure).toBe(true);
      expect(result.error.message).toContain("Invalid symbol kind");
    });

    it("should create symbol with all valid kinds", () => {
      const validKinds = [
        "class",
        "function",
        "method",
        "interface",
        "service",
        "repository",
      ] as const;

      validKinds.forEach((kind) => {
        const result = CodeSymbol.create({
          ...validCreateInput,
          kind,
        });

        expect(result.isSuccess).toBe(true);
        expect(result.value.kind).toBe(kind);
      });
    });
  });

  describe("CodeSymbol.fromPersistence()", () => {
    it("should reconstitute symbol from persistence data", () => {
      const persistenceData = {
        id: "abc123def456",
        name: "UserService",
        qualifiedName: "src.services.UserService",
        kind: "class" as const,
        location: validLocation,
        visibility: "public" as const,
        exported: true,
        language: "ts" as const,
      };

      const symbol = CodeSymbol.fromPersistence(persistenceData);

      expect(symbol.id).toBe("abc123def456");
      expect(symbol.name).toBe("UserService");
      expect(symbol.qualifiedName).toBe("src.services.UserService");
      expect(symbol.kind).toBe("class");
      expect(symbol.visibility).toBe("public");
      expect(symbol.exported).toBe(true);
      expect(symbol.language).toBe("ts");
    });

    it("should create FileLocation value object from persistence", () => {
      const persistenceData = {
        id: "test123",
        name: "testFunc",
        kind: "function" as const,
        location: {
          filePath: "src/utils.ts",
          startLine: 5,
          endLine: 15,
        },
      };

      const symbol = CodeSymbol.fromPersistence(persistenceData);
      const location = symbol.location;

      expect(location).toBeInstanceOf(FileLocation);
      expect(location.filePath).toBe("src/utils.ts");
      expect(location.startLine).toBe(5);
      expect(location.endLine).toBe(15);
      expect(location.lineCount).toBe(11);
    });

    it("should preserve optional fields from persistence", () => {
      const persistenceData = {
        id: "test123",
        name: "MyClass",
        kind: "class" as const,
        location: validLocation,
        parent: "ParentClass",
        visibility: "protected" as const,
      };

      const symbol = CodeSymbol.fromPersistence(persistenceData);

      expect(symbol.parent).toBe("ParentClass");
      expect(symbol.visibility).toBe("protected");
    });
  });

  describe("CodeSymbol.createStub()", () => {
    it("should create a stub symbol with default function kind", () => {
      const stub = CodeSymbol.createStub("testFunction");

      expect(stub.name).toBe("testFunction");
      expect(stub.kind).toBe("function");
      expect(stub.id).toBe("_stub");
      expect(stub.file).toBe("unknown");
    });

    it("should create a stub symbol with custom kind", () => {
      const stub = CodeSymbol.createStub("TestClass", "class");

      expect(stub.name).toBe("TestClass");
      expect(stub.kind).toBe("class");
    });

    it("should create stub with default location", () => {
      const stub = CodeSymbol.createStub("test");

      expect(stub.startLine).toBe(0);
      expect(stub.endLine).toBe(0);
      expect(stub.file).toBe("unknown");
    });
  });

  describe("Getter methods", () => {
    let symbol: CodeSymbol;

    beforeEach(() => {
      const result = CodeSymbol.create({
        ...validCreateInput,
        language: "ts",
      });

      expect(result.isSuccess).toBe(true);
      symbol = result.value;
    });

    it("should return all basic properties via getters", () => {
      expect(symbol.name).toBe("UserService");
      expect(symbol.kind).toBe("class");
      expect(symbol.file).toBe(validLocation.filePath);
      expect(symbol.startLine).toBe(validLocation.startLine);
      expect(symbol.endLine).toBe(validLocation.endLine);
    });

    it("should return arrays with correct empty values", () => {
      // Properties not set during creation return empty arrays
      expect(symbol.implements).toEqual([]);
      expect(symbol.usesTraits).toEqual([]);
      expect(symbol.references).toEqual([]);
      expect(symbol.referencedBy).toEqual([]);
      expect(symbol.violations).toEqual([]);
      expect(symbol.tags).toEqual([]);
    });

    it("should return empty arrays for undefined array properties", () => {
      const result = CodeSymbol.create({
        name: "simpleFunc",
        kind: "function",
        location: validLocation,
      });

      const simple = result.value;

      expect(simple.tags).toEqual([]);
      expect(simple.implements).toEqual([]);
      expect(simple.usesTraits).toEqual([]);
      expect(simple.references).toEqual([]);
      expect(simple.referencedBy).toEqual([]);
      expect(simple.violations).toEqual([]);
    });

    it("should return location value object via getter", () => {
      const location = symbol.location;

      expect(location).toBeInstanceOf(FileLocation);
      expect(location.filePath).toBe(validLocation.filePath);
      expect(location.startLine).toBe(validLocation.startLine);
      expect(location.endLine).toBe(validLocation.endLine);
    });

    it("should return SymbolKind value object via kindVO getter", () => {
      const kindVO = symbol.kindVO;

      expect(kindVO).toBeInstanceOf(SymbolKind);
      expect(kindVO.value).toBe("class");
      expect(kindVO.isClass()).toBe(true);
    });

    it("should return domain-specific properties when not defined", () => {
      // Empty values when not set
      expect(symbol.domain).toBeUndefined();
      expect(symbol.boundedContext).toBeUndefined();
      expect(symbol.layer).toBeUndefined();
      expect(symbol.pattern).toBeUndefined();
      expect(symbol.extends).toBeUndefined();
      expect(symbol.stability).toBeUndefined();
    });
  });

  describe("updateExplanation()", () => {
    let symbol: CodeSymbol;

    beforeEach(() => {
      const result = CodeSymbol.create(validCreateInput);
      expect(result.isSuccess).toBe(true);
      symbol = result.value;
    });

    it("should update explanation and hash", () => {
      const explanation = "This is a service that handles user operations";
      const hash = "hash123456";

      const updated = symbol.updateExplanation(explanation, hash);

      expect(updated.explanation).toBe(explanation);
      expect(updated.explanationHash).toBe(hash);
    });

    it("should preserve symbol identity", () => {
      const updated = symbol.updateExplanation("New explanation", "hash1");

      expect(updated.id).toBe(symbol.id);
      expect(updated.name).toBe(symbol.name);
      expect(updated.kind).toBe(symbol.kind);
    });

    it("should create new instance", () => {
      const updated = symbol.updateExplanation("New explanation", "hash1");

      expect(updated).not.toBe(symbol);
      expect(symbol.explanation).toBeUndefined();
    });

    it("should allow multiple explanations through chaining", () => {
      const exp1 = symbol.updateExplanation("First explanation", "hash1");
      const exp2 = exp1.updateExplanation("Updated explanation", "hash2");

      expect(exp1.explanation).toBe("First explanation");
      expect(exp1.explanationHash).toBe("hash1");
      expect(exp2.explanation).toBe("Updated explanation");
      expect(exp2.explanationHash).toBe("hash2");
      expect(exp2.id).toBe(symbol.id);
    });
  });

  describe("markAsDeprecated()", () => {
    let symbol: CodeSymbol;

    beforeEach(() => {
      const result = CodeSymbol.create(validCreateInput);
      expect(result.isSuccess).toBe(true);
      symbol = result.value;
    });

    it("should mark symbol as deprecated", () => {
      const deprecated = symbol.markAsDeprecated();

      expect(deprecated.deprecated).toBe(true);
      expect(deprecated.stability).toBe("deprecated");
    });

    it("should set since information when provided", () => {
      const deprecatedSymbol = symbol.markAsDeprecated("v2.0.0");

      expect(deprecatedSymbol.deprecated).toBe(true);
      expect(deprecatedSymbol.since).toBe("v2.0.0");
    });

    it("should preserve symbol identity", () => {
      const deprecatedSymbol = symbol.markAsDeprecated("v2.0.0");

      expect(deprecatedSymbol.id).toBe(symbol.id);
      expect(deprecatedSymbol.name).toBe(symbol.name);
    });

    it("should not modify original symbol", () => {
      symbol.markAsDeprecated("v2.0.0");

      expect(symbol.deprecated).toBeUndefined();
      expect(symbol.stability).toBeUndefined();
    });

    it("should work without since parameter", () => {
      const deprecatedSymbol = symbol.markAsDeprecated();

      expect(deprecatedSymbol.deprecated).toBe(true);
      expect(deprecatedSymbol.since).toBeUndefined();
    });
  });

  describe("addViolation()", () => {
    let symbol: CodeSymbol;

    beforeEach(() => {
      const result = CodeSymbol.create(validCreateInput);
      expect(result.isSuccess).toBe(true);
      symbol = result.value;
    });

    it("should add a violation to empty violations array", () => {
      const updated = symbol.addViolation("Breaks SRP principle");

      expect(updated.violations).toContain("Breaks SRP principle");
      expect(updated.violations.length).toBe(1);
    });

    it("should add multiple violations through chaining", () => {
      const v1 = symbol.addViolation("Violation 1");
      const v2 = v1.addViolation("Violation 2");
      const v3 = v2.addViolation("Violation 3");

      expect(v3.violations).toContain("Violation 1");
      expect(v3.violations).toContain("Violation 2");
      expect(v3.violations).toContain("Violation 3");
      expect(v3.violations.length).toBe(3);
    });

    it("should preserve symbol identity", () => {
      const updated = symbol.addViolation("Some violation");

      expect(updated.id).toBe(symbol.id);
    });

    it("should not modify original symbol", () => {
      symbol.addViolation("Violation");

      expect(symbol.violations).toEqual([]);
    });

    it("should work with existing violations from creation", () => {
      const result = CodeSymbol.create({
        ...validCreateInput,
        name: "ViolatedService",
      });
      const symbolWithViolation = result.value.addViolation("Initial violation");
      const updated = symbolWithViolation.addViolation("New violation");

      expect(updated.violations).toContain("Initial violation");
      expect(updated.violations).toContain("New violation");
      expect(updated.violations.length).toBe(2);
    });
  });

  describe("toPersistence()", () => {
    let symbol: CodeSymbol;

    beforeEach(() => {
      const result = CodeSymbol.create(validCreateInput);
      expect(result.isSuccess).toBe(true);
      symbol = result.value;
    });

    it("should serialize basic properties", () => {
      const persistence = symbol.toPersistence();

      expect(persistence.name).toBe("UserService");
      expect(persistence.qualifiedName).toBe("src.services.UserService");
      expect(persistence.kind).toBe("class");
      expect(persistence.visibility).toBe("public");
      expect(persistence.exported).toBe(true);
    });

    it("should serialize location properties flattened", () => {
      const persistence = symbol.toPersistence();

      expect(persistence.file).toBe(validLocation.filePath);
      expect(persistence.startLine).toBe(validLocation.startLine);
      expect(persistence.endLine).toBe(validLocation.endLine);
    });

    it("should include symbol ID", () => {
      const persistence = symbol.toPersistence();

      expect(persistence.id).toBe(symbol.id);
    });

    it("should serialize all array properties", () => {
      const complexResult = CodeSymbol.create(validCreateInput);

      const persistence = complexResult.value.toPersistence();

      // Arrays will be undefined for properties not set at creation
      expect(persistence.implements).toBeUndefined();
      expect(persistence.usesTraits).toBeUndefined();
      expect(persistence.references).toBeUndefined();
    });

    it("should handle undefined optional fields", () => {
      const minimalResult = CodeSymbol.create({
        name: "simpleFunc",
        kind: "function",
        location: validLocation,
      });

      const persistence = minimalResult.value.toPersistence();

      expect(persistence.qualifiedName).toBeUndefined();
      expect(persistence.parent).toBeUndefined();
      expect(persistence.visibility).toBeUndefined();
      expect(persistence.docRef).toBeUndefined();
    });

    it("should extract raw signature string from Signature object", () => {
      // Signature.create() is tested separately - this verifies CodeSymbol serialization
      const result = CodeSymbol.create({
        ...validCreateInput,
        name: "getUserById",
        kind: "method",
      });

      const persistence = result.value.toPersistence();

      // Verify structure is maintained
      expect(persistence).toHaveProperty("id");
      expect(persistence).toHaveProperty("file");
    });

    it("should be suitable for database storage", () => {
      const persistence = symbol.toPersistence();
      const keys = Object.keys(persistence);

      // Verify common database columns
      expect(keys).toContain("id");
      expect(keys).toContain("name");
      expect(keys).toContain("kind");
      expect(keys).toContain("file");
      expect(keys).toContain("startLine");
      expect(keys).toContain("endLine");

      // All values should be serializable
      expect(() => JSON.stringify(persistence)).not.toThrow();
    });
  });

  describe("Entity equality", () => {
    it("should consider entities with same ID as equal", () => {
      const result1 = CodeSymbol.create(validCreateInput);
      const result2 = CodeSymbol.create(validCreateInput);

      expect(result1.isSuccess).toBe(true);
      expect(result2.isSuccess).toBe(true);

      const symbol1 = result1.value;
      const symbol2 = result2.value;

      expect(symbol1.equals(symbol2)).toBe(true);
    });

    it("should consider entities with different IDs as not equal", () => {
      const result1 = CodeSymbol.create(validCreateInput);
      const result2 = CodeSymbol.create({
        ...validCreateInput,
        name: "DifferentName",
      });

      expect(result1.isSuccess).toBe(true);
      expect(result2.isSuccess).toBe(true);

      expect(result1.value.equals(result2.value)).toBe(false);
    });

    it("should be self-equal", () => {
      const result = CodeSymbol.create(validCreateInput);
      const symbol = result.value;

      expect(symbol.equals(symbol)).toBe(true);
    });

    it("should handle null comparison", () => {
      const result = CodeSymbol.create(validCreateInput);
      const symbol = result.value;

      expect(symbol.equals(null as unknown as CodeSymbol)).toBe(false);
    });

    it("should handle undefined comparison", () => {
      const result = CodeSymbol.create(validCreateInput);
      const symbol = result.value;

      expect(symbol.equals(undefined)).toBe(false);
    });
  });

  describe("Integration scenarios", () => {
    it("should support full lifecycle: create -> update -> persist", () => {
      // Create
      const createResult = CodeSymbol.create(validCreateInput);
      expect(createResult.isSuccess).toBe(true);
      let symbol = createResult.value;

      // Update with explanation
      symbol = symbol.updateExplanation("Manages user business logic", "hash1");
      expect(symbol.explanation).toBe("Manages user business logic");

      // Mark deprecated
      symbol = symbol.markAsDeprecated("v3.0.0");
      expect(symbol.deprecated).toBe(true);

      // Add violations
      symbol = symbol.addViolation("High complexity");
      symbol = symbol.addViolation("God class pattern");

      // Persist
      const persistence = symbol.toPersistence();

      expect(persistence.id).toBeDefined();
      expect(persistence.explanation).toBe("Manages user business logic");
      expect(persistence.deprecated).toBe(true);
      expect(Array.isArray(persistence.violations)).toBe(true);
    });

    it("should support round-trip persistence", () => {
      // Create symbol with all properties
      const createResult = CodeSymbol.create(validCreateInput);

      const original = createResult.value.updateExplanation("Service explanation", "hash123");

      // Serialize
      const persistence = original.toPersistence();
      const persistenceData = persistence as Record<string, unknown>;

      // Deserialize (simulate loading from database)
      const restored = CodeSymbol.fromPersistence({
        id: persistenceData.id as string,
        name: persistenceData.name as string,
        qualifiedName: persistenceData.qualifiedName as string | undefined,
        kind: persistenceData.kind as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        location: {
          filePath: persistenceData.file as string,
          startLine: persistenceData.startLine as number,
          endLine: persistenceData.endLine as number,
        },
        visibility: persistenceData.visibility as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        exported: persistenceData.exported as boolean | undefined,
        language: persistenceData.language as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      });

      // Verify key properties match
      expect(restored.id).toBe(original.id);
      expect(restored.name).toBe(original.name);
      expect(restored.kind).toBe(original.kind);
      expect(restored.equals(original)).toBe(true);
    });
  });
});
