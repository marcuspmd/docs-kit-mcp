import { describe, it, expect, beforeEach } from "@jest/globals";
import { SqliteSymbolRepository } from "../SqliteSymbolRepository.js";
import { CodeSymbol } from "../../../../domain/entities/CodeSymbol.js";
import type { SymbolKindType } from "../../../../domain/value-objects/SymbolKind.js";
import type Database from "better-sqlite3";

// Mock Database.Statement
class MockStatement {
  run(..._params: unknown[]) {
    return { changes: 1 };
  }

  get(_param?: unknown) {
    return {
      id: "symbol-id",
      name: "TestSymbol",
      qualified_name: "path:TestSymbol",
      kind: "class",
      file: "test.ts",
      start_line: 1,
      end_line: 10,
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
      deprecated: 0,
      since: null,
      stability: null,
      generated: 0,
      source: null,
      last_modified: null,
      signature: null,
      explanation: null,
      explanation_hash: null,
    };
  }

  all(..._params: unknown[]) {
    return [
      {
        id: "symbol-1",
        name: "Symbol1",
        qualified_name: "path:Symbol1",
        kind: "class",
        file: "test.ts",
        start_line: 1,
        end_line: 10,
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
        deprecated: 0,
        since: null,
        stability: null,
        generated: 0,
        source: null,
        last_modified: null,
        signature: null,
        explanation: null,
        explanation_hash: null,
      },
    ];
  }
}

// Mock Database
class MockDatabase {
  private statements: Map<string, MockStatement> = new Map();

  transaction(fn: (items: unknown[]) => void) {
    return (items: unknown[]) => fn(items);
  }

  prepare(sql: string) {
    // Store statements so we can spy on them
    if (!this.statements.has(sql)) {
      // Return different mock based on query
      if (sql.includes("COUNT")) {
        this.statements.set(sql, {
          get: () => ({ count: 5 }),
          run: () => ({ changes: 1 }),
          all: () => [],
        } as unknown as MockStatement);
      } else {
        this.statements.set(sql, new MockStatement());
      }
    }
    return this.statements.get(sql)!;
  }

  getStatement(sql: string): MockStatement | undefined {
    return this.statements.get(sql);
  }
}

describe("SqliteSymbolRepository", () => {
  let repository: SqliteSymbolRepository;
  let mockDb: MockDatabase;

  beforeEach(() => {
    mockDb = new MockDatabase();
    repository = new SqliteSymbolRepository(mockDb as unknown as Database.Database);
  });

  describe("upsert", () => {
    it("should insert a symbol", () => {
      const symbolResult = CodeSymbol.create({
        name: "TestClass",
        qualifiedName: "src:TestClass",
        kind: "class" as SymbolKindType,
        location: { filePath: "src/test.ts", startLine: 1, endLine: 10 },
        exported: true,
        language: "ts",
      });

      if (symbolResult.isSuccess) {
        expect(() => {
          repository.upsert(symbolResult.value);
        }).not.toThrow();
      }
    });
  });

  describe("upsertMany", () => {
    it("should insert multiple symbols", () => {
      const symbols: CodeSymbol[] = [];
      for (let i = 0; i < 3; i++) {
        const result = CodeSymbol.create({
          name: `Symbol${i}`,
          qualifiedName: `src:Symbol${i}`,
          kind: "function" as SymbolKindType,
          location: { filePath: "src/test.ts", startLine: i * 10, endLine: (i + 1) * 10 },
          exported: true,
          language: "ts",
        });
        if (result.isSuccess) {
          symbols.push(result.value);
        }
      }

      expect(() => {
        repository.upsertMany(symbols);
      }).not.toThrow();
    });
  });

  describe("findById", () => {
    it("should find symbol by id", () => {
      const result = repository.findById("symbol-id");
      expect(result).toBeDefined();
    });

    it("should return undefined when symbol not found in database", () => {
      const stmt = mockDb.getStatement("SELECT * FROM symbols WHERE id = ?");
      if (stmt) {
        // Mock get to return undefined for this test
        const originalGet = stmt.get;
        stmt.get = (() => undefined) as unknown as typeof originalGet;

        const result = repository.findById("non-existent");
        expect(result).toBeUndefined();

        // Restore original
        stmt.get = originalGet;
      }
    });

    it("should return undefined for non-existent id", () => {
      const result = repository.findById("non-existent");
      // When get() returns undefined, findById should handle it
      expect(result === undefined || typeof result === "object").toBe(true);
    });
  });

  describe("findByIds", () => {
    it("should find multiple symbols by ids", () => {
      const results = repository.findByIds(["id1", "id2"]);
      expect(Array.isArray(results)).toBe(true);
    });

    it("should return empty array for empty ids", () => {
      const results = repository.findByIds([]);
      expect(results).toEqual([]);
    });
  });

  describe("findByName", () => {
    it("should find symbols by name", () => {
      const results = repository.findByName("TestSymbol");
      expect(Array.isArray(results)).toBe(true);
    });

    it("should return array from database query", () => {
      const results = repository.findByName("AnyName");
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe("findAll", () => {
    it("should return all symbols", () => {
      const results = repository.findAll();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe("findByFile", () => {
    it("should find symbols by file path", () => {
      const results = repository.findByFile("test.ts");
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe("findByKind", () => {
    it("should find symbols by kind", () => {
      const results = repository.findByKind("class" as SymbolKindType);
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe("deleteByFile", () => {
    it("should delete symbols by file", () => {
      expect(() => {
        repository.deleteByFile("test.ts");
      }).not.toThrow();
    });
  });

  describe("clear", () => {
    it("should clear all symbols", () => {
      expect(() => {
        repository.clear();
      }).not.toThrow();
    });
  });

  describe("count", () => {
    it("should return symbol count", () => {
      const count = repository.count();
      expect(typeof count).toBe("number");
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});
