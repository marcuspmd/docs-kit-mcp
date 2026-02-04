import { describe, it, expect, beforeEach } from "@jest/globals";
import { InMemoryRelationshipRepository } from "../InMemoryRelationshipRepository.js";
import { SymbolRelationship } from "../../../../domain/entities/SymbolRelationship.js";

describe("InMemoryRelationshipRepository", () => {
  let repository: InMemoryRelationshipRepository;
  let relationship1: SymbolRelationship;
  let relationship2: SymbolRelationship;

  beforeEach(() => {
    repository = new InMemoryRelationshipRepository();

    relationship1 = SymbolRelationship.fromPersistence({
      sourceId: "symbol-1",
      targetId: "symbol-2",
      type: "imports",
    });

    relationship2 = SymbolRelationship.fromPersistence({
      sourceId: "symbol-2",
      targetId: "symbol-3",
      type: "implements",
    });
  });

  describe("upsert", () => {
    it("should add a new relationship", () => {
      repository.upsert(relationship1);
      expect(repository.count()).toBe(1);
    });

    it("should update existing relationship", () => {
      repository.upsert(relationship1);
      repository.upsert(relationship1);
      expect(repository.count()).toBe(1);
    });
  });

  describe("upsertMany", () => {
    it("should add multiple relationships", () => {
      repository.upsertMany([relationship1, relationship2]);
      expect(repository.count()).toBe(2);
    });

    it("should handle empty array", () => {
      repository.upsertMany([]);
      expect(repository.count()).toBe(0);
    });
  });

  describe("findBySource", () => {
    it("should find relationships by source id", () => {
      repository.upsertMany([relationship1, relationship2]);
      const found = repository.findBySource("symbol-1");

      expect(found).toHaveLength(1);
      expect(found[0].sourceId).toBe("symbol-1");
      expect(found[0].targetId).toBe("symbol-2");
    });

    it("should return empty array for non-existent source", () => {
      repository.upsert(relationship1);
      const found = repository.findBySource("non-existent");
      expect(found).toHaveLength(0);
    });

    it("should find all relationships from a source", () => {
      const rel3 = SymbolRelationship.fromPersistence({
        sourceId: "symbol-1",
        targetId: "symbol-4",
        type: "extends",
      });

      repository.upsertMany([relationship1, rel3, relationship2]);
      const found = repository.findBySource("symbol-1");

      expect(found).toHaveLength(2);
    });
  });

  describe("findByTarget", () => {
    it("should find relationships by target id", () => {
      repository.upsertMany([relationship1, relationship2]);
      const found = repository.findByTarget("symbol-2");

      expect(found).toHaveLength(1);
      expect(found[0].sourceId).toBe("symbol-1");
      expect(found[0].targetId).toBe("symbol-2");
    });

    it("should return empty array for non-existent target", () => {
      repository.upsert(relationship1);
      const found = repository.findByTarget("non-existent");
      expect(found).toHaveLength(0);
    });

    it("should find all relationships to a target", () => {
      const rel3 = SymbolRelationship.fromPersistence({
        sourceId: "symbol-3",
        targetId: "symbol-2",
        type: "implements",
      });

      repository.upsertMany([relationship1, rel3, relationship2]);
      const found = repository.findByTarget("symbol-2");

      expect(found).toHaveLength(2);
    });
  });

  describe("findAll", () => {
    it("should return all relationships", () => {
      repository.upsertMany([relationship1, relationship2]);
      const all = repository.findAll();

      expect(all).toHaveLength(2);
    });

    it("should return empty array when no relationships", () => {
      const all = repository.findAll();
      expect(all).toHaveLength(0);
    });
  });

  describe("deleteBySource", () => {
    it("should delete all relationships from a source", () => {
      repository.upsertMany([relationship1, relationship2]);
      repository.deleteBySource("symbol-1");

      expect(repository.count()).toBe(1);
      expect(repository.findBySource("symbol-1")).toHaveLength(0);
    });

    it("should only delete relationships from specified source", () => {
      const rel3 = SymbolRelationship.fromPersistence({
        sourceId: "symbol-1",
        targetId: "symbol-4",
        type: "extends",
      });

      repository.upsertMany([relationship1, rel3, relationship2]);
      repository.deleteBySource("symbol-1");

      expect(repository.count()).toBe(1);
      expect(repository.findBySource("symbol-2")).toHaveLength(1);
    });

    it("should handle delete of non-existent source", () => {
      repository.upsert(relationship1);
      repository.deleteBySource("non-existent");

      expect(repository.count()).toBe(1);
    });
  });

  describe("clear", () => {
    it("should delete all relationships", () => {
      repository.upsertMany([relationship1, relationship2]);
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
      repository.upsert(relationship1);
      expect(repository.count()).toBe(1);
      repository.upsert(relationship2);
      expect(repository.count()).toBe(2);
    });
  });

  describe("relationship types", () => {
    it("should handle different relationship types", () => {
      const imports = SymbolRelationship.fromPersistence({
        sourceId: "a",
        targetId: "b",
        type: "imports",
      });
      const implements_ = SymbolRelationship.fromPersistence({
        sourceId: "c",
        targetId: "d",
        type: "implements",
      });
      const extends_ = SymbolRelationship.fromPersistence({
        sourceId: "e",
        targetId: "f",
        type: "extends",
      });

      repository.upsertMany([imports, implements_, extends_]);

      expect(repository.findBySource("a")[0].type).toBe("imports");
      expect(repository.findBySource("c")[0].type).toBe("implements");
      expect(repository.findBySource("e")[0].type).toBe("extends");
    });
  });
});
