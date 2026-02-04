import { describe, it, expect, beforeEach } from "@jest/globals";
import { InMemorySymbolRepository } from "../InMemorySymbolRepository.js";
import { CodeSymbol } from "../../../../domain/entities/CodeSymbol.js";
import type { SymbolKindType } from "../../../../domain/value-objects/SymbolKind.js";

describe("InMemorySymbolRepository", () => {
  let repository: InMemorySymbolRepository;
  let symbol1: CodeSymbol;
  let symbol2: CodeSymbol;

  beforeEach(() => {
    repository = new InMemorySymbolRepository();

    const result1 = CodeSymbol.create({
      name: "UserService",
      qualifiedName: "src/services/UserService.ts:UserService",
      kind: "class" as SymbolKindType,
      location: {
        filePath: "src/services/UserService.ts",
        startLine: 1,
        endLine: 50,
      },
      exported: true,
      language: "ts",
    });

    const result2 = CodeSymbol.create({
      name: "getUser",
      qualifiedName: "src/services/UserService.ts:UserService.getUser",
      kind: "method" as SymbolKindType,
      location: {
        filePath: "src/services/UserService.ts",
        startLine: 10,
        endLine: 20,
      },
      exported: false,
      language: "ts",
    });

    symbol1 = result1.isSuccess ? result1.value : null!;
    symbol2 = result2.isSuccess ? result2.value : null!;
  });

  describe("upsert", () => {
    it("should add a new symbol", () => {
      repository.upsert(symbol1);
      expect(repository.count()).toBe(1);
      expect(repository.findById(symbol1.id)).toEqual(symbol1);
    });

    it("should update existing symbol", () => {
      repository.upsert(symbol1);
      const updatedResult = CodeSymbol.create({
        name: "UserService",
        qualifiedName: "src/services/UserService.ts:UserService",
        kind: "class" as SymbolKindType,
        location: {
          filePath: "src/services/UserService.ts",
          startLine: 1,
          endLine: 60,
        },
        exported: true,
        language: "ts",
      });

      if (updatedResult.isSuccess) {
        repository.upsert(updatedResult.value);
        expect(repository.count()).toBe(1);
      }
    });
  });

  describe("upsertMany", () => {
    it("should add multiple symbols", () => {
      repository.upsertMany([symbol1, symbol2]);
      expect(repository.count()).toBe(2);
    });

    it("should handle empty array", () => {
      repository.upsertMany([]);
      expect(repository.count()).toBe(0);
    });
  });

  describe("findById", () => {
    it("should find existing symbol by id", () => {
      repository.upsert(symbol1);
      const found = repository.findById(symbol1.id);
      expect(found).toEqual(symbol1);
    });

    it("should return undefined for non-existent id", () => {
      const found = repository.findById("non-existent-id");
      expect(found).toBeUndefined();
    });
  });

  describe("findByIds", () => {
    it("should find multiple symbols by ids", () => {
      repository.upsertMany([symbol1, symbol2]);
      const found = repository.findByIds([symbol1.id, symbol2.id]);
      expect(found).toHaveLength(2);
      expect(found).toContainEqual(symbol1);
      expect(found).toContainEqual(symbol2);
    });

    it("should filter out non-existent ids", () => {
      repository.upsert(symbol1);
      const found = repository.findByIds([symbol1.id, "non-existent"]);
      expect(found).toHaveLength(1);
      expect(found).toContainEqual(symbol1);
    });

    it("should handle empty ids array", () => {
      repository.upsert(symbol1);
      const found = repository.findByIds([]);
      expect(found).toHaveLength(0);
    });
  });

  describe("findByName", () => {
    it("should find symbol by name", () => {
      repository.upsert(symbol1);
      const found = repository.findByName("UserService");
      expect(found).toHaveLength(1);
      expect(found[0]).toEqual(symbol1);
    });

    it("should find symbol by qualified name", () => {
      repository.upsert(symbol1);
      const found = repository.findByName(symbol1.qualifiedName ?? "");
      expect(found).toHaveLength(1);
    });

    it("should return empty array for non-existent name", () => {
      const found = repository.findByName("NonExistent");
      expect(found).toHaveLength(0);
    });
  });

  describe("findAll", () => {
    it("should return all symbols", () => {
      repository.upsertMany([symbol1, symbol2]);
      const all = repository.findAll();
      expect(all).toHaveLength(2);
    });

    it("should return empty array when no symbols", () => {
      const all = repository.findAll();
      expect(all).toHaveLength(0);
    });
  });

  describe("findByFile", () => {
    it("should find symbols by file path", () => {
      repository.upsertMany([symbol1, symbol2]);
      const found = repository.findByFile("src/services/UserService.ts");
      expect(found).toHaveLength(2);
    });

    it("should return empty array for non-existent file", () => {
      repository.upsert(symbol1);
      const found = repository.findByFile("non-existent.ts");
      expect(found).toHaveLength(0);
    });
  });

  describe("findByKind", () => {
    it("should find symbols by kind", () => {
      repository.upsertMany([symbol1, symbol2]);
      const found = repository.findByKind("class" as SymbolKindType);
      expect(found).toHaveLength(1);
      expect(found[0]).toEqual(symbol1);
    });

    it("should return empty array for non-existent kind", () => {
      repository.upsert(symbol1);
      const found = repository.findByKind("interface" as SymbolKindType);
      expect(found).toHaveLength(0);
    });
  });

  describe("deleteByFile", () => {
    it("should delete all symbols from a file", () => {
      repository.upsertMany([symbol1, symbol2]);
      repository.deleteByFile("src/services/UserService.ts");
      expect(repository.count()).toBe(0);
    });

    it("should only delete symbols from specified file", () => {
      const symbol3Result = CodeSymbol.create({
        name: "OrderService",
        qualifiedName: "src/services/OrderService.ts:OrderService",
        kind: "class" as SymbolKindType,
        location: {
          filePath: "src/services/OrderService.ts",
          startLine: 1,
          endLine: 30,
        },
        exported: true,
        language: "ts",
      });

      if (symbol3Result.isSuccess) {
        repository.upsertMany([symbol1, symbol2, symbol3Result.value]);
        repository.deleteByFile("src/services/UserService.ts");
        expect(repository.count()).toBe(1);
        expect(repository.findById(symbol3Result.value.id)).toBeDefined();
      }
    });
  });

  describe("clear", () => {
    it("should delete all symbols", () => {
      repository.upsertMany([symbol1, symbol2]);
      repository.clear();
      expect(repository.count()).toBe(0);
      expect(repository.findAll()).toHaveLength(0);
    });

    it("should handle clear on empty repository", () => {
      repository.clear();
      expect(repository.count()).toBe(0);
    });
  });

  describe("count", () => {
    it("should return correct count", () => {
      expect(repository.count()).toBe(0);
      repository.upsert(symbol1);
      expect(repository.count()).toBe(1);
      repository.upsert(symbol2);
      expect(repository.count()).toBe(2);
    });
  });
});
