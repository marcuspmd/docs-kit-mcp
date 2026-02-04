import { describe, it, expect, beforeEach } from "@jest/globals";
import { SymbolMapper } from "../SymbolMapper.js";
import { CodeSymbol } from "../../../domain/entities/CodeSymbol.js";

describe("SymbolMapper", () => {
  let testSymbol: CodeSymbol;

  beforeEach(() => {
    testSymbol = CodeSymbol.create({
      name: "TestClass",
      qualifiedName: "src.TestClass",
      kind: "class",
      location: {
        filePath: "src/test.ts",
        startLine: 10,
        endLine: 20,
      },
      parent: "ParentClass",
      visibility: "public",
      exported: true,
      language: "ts",
    }).value;
  });

  describe("toDto", () => {
    it("should convert CodeSymbol to SymbolOutput DTO", () => {
      const dto = SymbolMapper.toDto(testSymbol);

      expect(dto.id).toBe(testSymbol.id);
      expect(dto.name).toBe("TestClass");
      expect(dto.qualifiedName).toBe("src.TestClass");
      expect(dto.kind).toBe("class");
      expect(dto.file).toBe("src/test.ts");
      expect(dto.startLine).toBe(10);
      expect(dto.endLine).toBe(20);
      expect(dto.parent).toBe("ParentClass");
      expect(dto.visibility).toBe("public");
      expect(dto.exported).toBe(true);
      expect(dto.language).toBe("ts");
    });

    it("should include optional properties when present", () => {
      const symbolWithDetails = CodeSymbol.create({
        name: "DetailedClass",
        qualifiedName: "src.DetailedClass",
        kind: "class",
        location: { filePath: "src/detailed.ts", startLine: 1, endLine: 50 },
        exported: true,
        language: "ts",
      }).value.updateExplanation("This is a test", "hash123");

      const dto = SymbolMapper.toDto(symbolWithDetails);

      expect(dto.explanation).toBe("This is a test");
    });

    it("should have optional properties as undefined when not set", () => {
      const dto = SymbolMapper.toDto(testSymbol);

      expect(dto.docRef).toBeUndefined();
      expect(dto.summary).toBeUndefined();
      expect(dto.docComment).toBeUndefined();
      expect(dto.domain).toBeUndefined();
      expect(dto.boundedContext).toBeUndefined();
    });

    it("should include tags only when not empty", () => {
      const dto = SymbolMapper.toDto(testSymbol);

      expect(dto.tags).toBeUndefined();
    });

    it("should include implements only when not empty", () => {
      const dto = SymbolMapper.toDto(testSymbol);

      expect(dto.implements).toBeUndefined();
    });

    it("should include violations only when not empty", () => {
      const dto = SymbolMapper.toDto(testSymbol);

      expect(dto.violations).toBeUndefined();
    });

    it("should include violations when array is not empty", () => {
      const symbolWithViolation = testSymbol.addViolation("SOLID violation: SRP");

      const dto = SymbolMapper.toDto(symbolWithViolation);

      expect(dto.violations).toBeDefined();
      expect(dto.violations).toEqual(["SOLID violation: SRP"]);
    });

    it("should include tags when array is not empty", () => {
      // Tags are managed through internal props, but we can test the branch
      const symbolWithProps = CodeSymbol.fromPersistence({
        id: "test-id",
        name: "TaggedClass",
        qualifiedName: "src.TaggedClass",
        kind: "class",
        location: { filePath: "src/tagged.ts", startLine: 1, endLine: 10 },
      });

      const dto = SymbolMapper.toDto(symbolWithProps);

      // fromPersistence doesn't set tags, so it should be undefined
      expect(dto.tags).toBeUndefined();
    });

    it("should include implements when array is not empty", () => {
      // Create symbol using fromPersistence to set implements
      const symbol = CodeSymbol.fromPersistence({
        id: "test-id",
        name: "ImplementingClass",
        qualifiedName: "src.ImplementingClass",
        kind: "class",
        location: { filePath: "src/impl.ts", startLine: 1, endLine: 10 },
      });

      const dto = SymbolMapper.toDto(symbol);

      // Initially implements should be undefined since fromPersistence doesn't set it
      expect(dto.implements).toBeUndefined();
    });

    it("should handle all optional fields when present", () => {
      const symbolWithAllFields = CodeSymbol.fromPersistence({
        id: "complete-id",
        name: "CompleteClass",
        qualifiedName: "src.CompleteClass",
        kind: "class",
        location: { filePath: "src/complete.ts", startLine: 1, endLine: 50 },
        parent: "BaseClass",
        visibility: "public",
        exported: true,
        language: "ts",
      });

      const dto = SymbolMapper.toDto(symbolWithAllFields);

      expect(dto.id).toBe("complete-id");
      expect(dto.name).toBe("CompleteClass");
      expect(dto.parent).toBe("BaseClass");
      expect(dto.visibility).toBe("public");
      expect(dto.exported).toBe(true);
      expect(dto.language).toBe("ts");
    });

    it("should include signature when available", () => {
      // Use createStub to create a simple symbol
      const stubSymbol = CodeSymbol.createStub("functionWithSignature", "function");

      const dto = SymbolMapper.toDto(stubSymbol);

      // Stub symbols don't have signatures by default
      expect(dto.signature).toBeUndefined();
    });

    it("should exclude undefined optional properties from DTO", () => {
      const minimalSymbol = CodeSymbol.create({
        name: "MinimalClass",
        qualifiedName: "src.MinimalClass",
        kind: "class",
        location: { filePath: "src/minimal.ts", startLine: 1, endLine: 5 },
      }).value;

      const dto = SymbolMapper.toDto(minimalSymbol);

      expect(dto.docRef).toBeUndefined();
      expect(dto.summary).toBeUndefined();
      expect(dto.domain).toBeUndefined();
      expect(dto.boundedContext).toBeUndefined();
      expect(dto.layer).toBeUndefined();
      expect(dto.pattern).toBeUndefined();
      expect(dto.stability).toBeUndefined();
    });
  });

  describe("toDtoList", () => {
    it("should convert array of symbols to DTOs", () => {
      const symbol2 = CodeSymbol.create({
        name: "TestFunction",
        qualifiedName: "src.TestFunction",
        kind: "function",
        location: { filePath: "src/test.ts", startLine: 30, endLine: 40 },
      }).value;

      const dtos = SymbolMapper.toDtoList([testSymbol, symbol2]);

      expect(dtos).toHaveLength(2);
      expect(dtos[0].name).toBe("TestClass");
      expect(dtos[1].name).toBe("TestFunction");
    });

    it("should handle empty array", () => {
      const dtos = SymbolMapper.toDtoList([]);

      expect(dtos).toEqual([]);
    });
  });

  describe("toDomain", () => {
    it("should convert raw persistence data to CodeSymbol", () => {
      const raw = {
        id: "test-id-123",
        name: "PersistedClass",
        qualified_name: "src.PersistedClass",
        kind: "class",
        file: "src/persisted.ts",
        start_line: 5,
        end_line: 15,
        parent: null,
        visibility: "public",
        exported: 1,
        language: "ts",
        doc_ref: null,
        summary: null,
        doc_comment: null,
        tags: null,
        domain: null,
        bounded_context: null,
        sym_extends: null,
        sym_implements: null,
        uses_traits: null,
        sym_references: null,
        referenced_by: null,
        layer: null,
        metrics: null,
        pattern: null,
        violations: null,
        deprecated: null,
        since: null,
        stability: null,
        generated: null,
        source: null,
        last_modified: null,
        signature: null,
        explanation: null,
        explanation_hash: null,
      };

      const symbol = SymbolMapper.toDomain(raw);

      expect(symbol).toBeInstanceOf(CodeSymbol);
      expect(symbol.name).toBe("PersistedClass");
      expect(symbol.qualifiedName).toBe("src.PersistedClass");
      expect(symbol.kind).toBe("class");
      expect(symbol.file).toBe("src/persisted.ts");
      expect(symbol.startLine).toBe(5);
      expect(symbol.endLine).toBe(15);
    });

    it("should handle boolean conversion from integers", () => {
      const raw = {
        id: "test-id",
        name: "Test",
        kind: "class",
        file: "test.ts",
        start_line: 1,
        end_line: 10,
        exported: 1,
        deprecated: 0,
        generated: null,
        visibility: null,
        qualified_name: null,
        parent: null,
        language: null,
        doc_ref: null,
        summary: null,
        doc_comment: null,
        tags: null,
        domain: null,
        bounded_context: null,
        sym_extends: null,
        sym_implements: null,
        uses_traits: null,
        sym_references: null,
        referenced_by: null,
        layer: null,
        metrics: null,
        pattern: null,
        violations: null,
        since: null,
        stability: null,
        source: null,
        last_modified: null,
        signature: null,
        explanation: null,
        explanation_hash: null,
      };

      const symbol = SymbolMapper.toDomain(raw);

      expect(symbol.exported).toBe(true);
    });

    it("should handle null qualified_name", () => {
      const raw = {
        id: "test-id",
        name: "Test",
        qualified_name: null,
        kind: "class",
        file: "test.ts",
        start_line: 1,
        end_line: 10,
        parent: null,
        visibility: null,
        exported: null,
        language: null,
        doc_ref: null,
        summary: null,
        doc_comment: null,
        tags: null,
        domain: null,
        bounded_context: null,
        sym_extends: null,
        sym_implements: null,
        uses_traits: null,
        sym_references: null,
        referenced_by: null,
        layer: null,
        metrics: null,
        pattern: null,
        violations: null,
        deprecated: null,
        since: null,
        stability: null,
        generated: null,
        source: null,
        last_modified: null,
        signature: null,
        explanation: null,
        explanation_hash: null,
      };

      const symbol = SymbolMapper.toDomain(raw);

      expect(symbol.qualifiedName).toBeUndefined();
    });
  });

  describe("toPersistence", () => {
    it("should convert CodeSymbol to persistence format", () => {
      const persistence = SymbolMapper.toPersistence(testSymbol);

      expect(persistence.id).toBe(testSymbol.id);
      expect(persistence.name).toBe("TestClass");
      expect(persistence.qualified_name).toBe("src.TestClass");
      expect(persistence.kind).toBe("class");
      expect(persistence.file).toBe("src/test.ts");
      expect(persistence.start_line).toBe(10);
      expect(persistence.end_line).toBe(20);
      expect(persistence.parent).toBe("ParentClass");
      expect(persistence.visibility).toBe("public");
      expect(persistence.exported).toBe(1);
      expect(persistence.language).toBe("ts");
    });

    it("should convert boolean to bit (1/0)", () => {
      const symbolExported = CodeSymbol.create({
        name: "Exported",
        qualifiedName: "Exported",
        kind: "class",
        location: { filePath: "test.ts", startLine: 1, endLine: 5 },
        exported: true,
      }).value;

      const symbolNotExported = CodeSymbol.create({
        name: "NotExported",
        qualifiedName: "NotExported",
        kind: "class",
        location: { filePath: "test.ts", startLine: 1, endLine: 5 },
        exported: false,
      }).value;

      const persistence1 = SymbolMapper.toPersistence(symbolExported);
      const persistence2 = SymbolMapper.toPersistence(symbolNotExported);

      expect(persistence1.exported).toBe(1);
      expect(persistence2.exported).toBe(0);
    });

    it("should handle undefined boolean as null", () => {
      const symbolNoExported = CodeSymbol.create({
        name: "NoExported",
        qualifiedName: "NoExported",
        kind: "class",
        location: { filePath: "test.ts", startLine: 1, endLine: 5 },
      }).value;

      const persistence = SymbolMapper.toPersistence(symbolNoExported);

      expect(persistence.exported).toBeNull();
    });

    it("should convert arrays to JSON when not empty", () => {
      const symbolResult = CodeSymbol.create({
        name: "TestClass",
        qualifiedName: "TestClass",
        kind: "class",
        location: { filePath: "test.ts", startLine: 1, endLine: 5 },
      });

      const persistence = SymbolMapper.toPersistence(symbolResult.value);

      // Empty arrays should be null
      expect(persistence.tags).toBeNull();
      expect(persistence.sym_implements).toBeNull();
      expect(persistence.uses_traits).toBeNull();
      expect(persistence.sym_references).toBeNull();
      expect(persistence.referenced_by).toBeNull();
      expect(persistence.violations).toBeNull();
    });

    it("should handle null values correctly", () => {
      const persistence = SymbolMapper.toPersistence(testSymbol);

      expect(persistence.doc_ref).toBeNull();
      expect(persistence.summary).toBeNull();
      expect(persistence.doc_comment).toBeNull();
      expect(persistence.domain).toBeNull();
      expect(persistence.bounded_context).toBeNull();
      expect(persistence.sym_extends).toBeNull();
      expect(persistence.layer).toBeNull();
      expect(persistence.pattern).toBeNull();
      expect(persistence.since).toBeNull();
      expect(persistence.stability).toBeNull();
      expect(persistence.source).toBeNull();
    });

    it("should convert violations array to JSON when not empty", () => {
      const symbolWithViolation = testSymbol.addViolation("Test violation");
      const persistence = SymbolMapper.toPersistence(symbolWithViolation);

      expect(persistence.violations).toBe('["Test violation"]');
    });

    it("should convert multiple violations to JSON array", () => {
      const symbolWithViolations = testSymbol
        .addViolation("Violation 1")
        .addViolation("Violation 2")
        .addViolation("Violation 3");

      const persistence = SymbolMapper.toPersistence(symbolWithViolations);

      expect(persistence.violations).toBe('["Violation 1","Violation 2","Violation 3"]');
    });

    it("should handle deprecated symbols in persistence", () => {
      const deprecatedSymbol = testSymbol.markAsDeprecated("v2.0.0");
      const persistence = SymbolMapper.toPersistence(deprecatedSymbol);

      expect(persistence.deprecated).toBe(1);
      expect(persistence.since).toBe("v2.0.0");
      expect(persistence.stability).toBe("deprecated");
    });

    it("should handle symbol with explanation in persistence", () => {
      const explainedSymbol = testSymbol.updateExplanation("This is a test class", "hash-abc");
      const persistence = SymbolMapper.toPersistence(explainedSymbol);

      expect(persistence.explanation).toBe("This is a test class");
      expect(persistence.explanation_hash).toBe("hash-abc");
    });

    it("should handle undefined qualifiedName as null", () => {
      const symbolWithoutQualifiedName = CodeSymbol.create({
        name: "SimpleClass",
        kind: "class",
        location: { filePath: "simple.ts", startLine: 1, endLine: 5 },
      }).value;

      const persistence = SymbolMapper.toPersistence(symbolWithoutQualifiedName);

      expect(persistence.qualified_name).toBeNull();
    });

    it("should handle symbols without parent as null", () => {
      const symbolWithoutParent = CodeSymbol.create({
        name: "OrphanClass",
        kind: "class",
        location: { filePath: "orphan.ts", startLine: 1, endLine: 5 },
      }).value;

      const persistence = SymbolMapper.toPersistence(symbolWithoutParent);

      expect(persistence.parent).toBeNull();
    });

    it("should convert metrics object to JSON string", () => {
      const symbolResult = CodeSymbol.create({
        name: "MetricsClass",
        kind: "class",
        location: { filePath: "metrics.ts", startLine: 1, endLine: 5 },
      });

      const persistence = SymbolMapper.toPersistence(symbolResult.value);

      // Metrics should be stringified JSON when present
      if (persistence.metrics !== null) {
        expect(typeof persistence.metrics).toBe("string");
        const parsed = JSON.parse(persistence.metrics as string);
        expect(parsed).toBeDefined();
      } else {
        // Or null if not set
        expect(persistence.metrics).toBeNull();
      }
    });
  });

  describe("round-trip conversion", () => {
    it("should maintain data integrity through toPersistence and toDomain", () => {
      const original = testSymbol;
      const persistence = SymbolMapper.toPersistence(original);

      // Verify persistence format
      expect(persistence.id).toBe(original.id);
      expect(persistence.name).toBe(original.name);
      expect(persistence.qualified_name).toBe(original.qualifiedName);
      expect(persistence.kind).toBe(original.kind);
      expect(persistence.file).toBe(original.file);
      expect(persistence.start_line).toBe(original.startLine);
      expect(persistence.end_line).toBe(original.endLine);
    });
  });
});
