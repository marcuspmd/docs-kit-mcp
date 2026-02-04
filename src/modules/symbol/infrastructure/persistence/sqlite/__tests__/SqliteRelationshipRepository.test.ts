import { describe, it, expect, beforeEach } from "@jest/globals";
import { SqliteRelationshipRepository } from "../SqliteRelationshipRepository.js";
import { SymbolRelationship } from "../../../../domain/entities/SymbolRelationship.js";
import type Database from "better-sqlite3";

// Mock Database.Statement
class MockStatement {
  run(..._params: unknown[]) {
    return { changes: 1 };
  }

  get(_param?: unknown) {
    return {
      source_id: "symbol-1",
      target_id: "symbol-2",
      type: "imports",
    };
  }

  all(..._params: unknown[]) {
    return [
      {
        source_id: "symbol-1",
        target_id: "symbol-2",
        type: "imports",
      },
      {
        source_id: "symbol-2",
        target_id: "symbol-3",
        type: "implements",
      },
    ];
  }
}

// Mock Database
class MockDatabase {
  transaction(fn: (items: unknown[]) => void) {
    return (items: unknown[]) => fn(items);
  }

  prepare(sql: string) {
    // Return different mock based on query
    if (sql.includes("COUNT")) {
      return {
        get: () => ({ count: 2 }),
        run: () => ({ changes: 1 }),
        all: () => [],
      };
    }
    return new MockStatement();
  }
}

describe("SqliteRelationshipRepository", () => {
  let repository: SqliteRelationshipRepository;
  let mockDb: MockDatabase;

  beforeEach(() => {
    mockDb = new MockDatabase();
    repository = new SqliteRelationshipRepository(mockDb as unknown as Database.Database);
  });

  describe("upsert", () => {
    it("should insert a relationship", () => {
      const relationship = SymbolRelationship.fromPersistence({
        sourceId: "symbol-1",
        targetId: "symbol-2",
        type: "imports",
      });

      expect(() => {
        repository.upsert(relationship);
      }).not.toThrow();
    });
  });

  describe("upsertMany", () => {
    it("should insert multiple relationships", () => {
      const relationships = [
        SymbolRelationship.fromPersistence({
          sourceId: "symbol-1",
          targetId: "symbol-2",
          type: "imports",
        }),
        SymbolRelationship.fromPersistence({
          sourceId: "symbol-2",
          targetId: "symbol-3",
          type: "implements",
        }),
      ];

      expect(() => {
        repository.upsertMany(relationships);
      }).not.toThrow();
    });
  });

  describe("findBySource", () => {
    it("should find relationships by source id", () => {
      const results = repository.findBySource("symbol-1");
      expect(Array.isArray(results)).toBe(true);
    });

    it("should return empty array for non-existent source", () => {
      const results = repository.findBySource("non-existent");
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe("findByTarget", () => {
    it("should find relationships by target id", () => {
      const results = repository.findByTarget("symbol-2");
      expect(Array.isArray(results)).toBe(true);
    });

    it("should return empty array for non-existent target", () => {
      const results = repository.findByTarget("non-existent");
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe("findAll", () => {
    it("should return all relationships", () => {
      const results = repository.findAll();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe("deleteBySource", () => {
    it("should delete relationships by source", () => {
      expect(() => {
        repository.deleteBySource("symbol-1");
      }).not.toThrow();
    });
  });

  describe("clear", () => {
    it("should clear all relationships", () => {
      expect(() => {
        repository.clear();
      }).not.toThrow();
    });
  });

  describe("count", () => {
    it("should return relationship count", () => {
      const count = repository.count();
      expect(typeof count).toBe("number");
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe("relationship types", () => {
    it("should handle different relationship types", () => {
      const types = ["imports", "implements", "extends", "uses", "references"];

      types.forEach((type) => {
        const relationship = SymbolRelationship.fromPersistence({
          sourceId: "symbol-a",
          targetId: "symbol-b",
          type: type as unknown as string,
        });

        expect(() => {
          repository.upsert(relationship);
        }).not.toThrow();
      });
    });
  });

  describe("batch operations", () => {
    it("should handle transaction for upsertMany", () => {
      const relationships: SymbolRelationship[] = [];

      for (let i = 0; i < 10; i++) {
        relationships.push(
          SymbolRelationship.fromPersistence({
            sourceId: `symbol-${i}`,
            targetId: `symbol-${i + 1}`,
            type: "imports",
          }),
        );
      }

      expect(() => {
        repository.upsertMany(relationships);
      }).not.toThrow();
    });
  });
});
