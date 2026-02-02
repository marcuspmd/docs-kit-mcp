import { createKnowledgeGraph } from "../graph.js";
import { createDatabase, initializeSchema } from "../../storage/db.js";
import type { CodeSymbol } from "../../indexer/symbol.types.js";
import type Database from "better-sqlite3";

function sym(overrides: Partial<CodeSymbol> & { id: string; name: string }): CodeSymbol {
  return {
    kind: "class",
    file: "src/test.ts",
    startLine: 1,
    endLine: 10,
    ...overrides,
  } as CodeSymbol;
}

describe("KnowledgeGraph", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createDatabase({ inMemory: true });
    initializeSchema(db);
  });

  afterEach(() => {
    db.close();
  });

  describe("addRelationship / removeRelationship", () => {
    it("adds and retrieves a relationship", () => {
      const graph = createKnowledgeGraph(db);
      graph.addRelationship({ sourceId: "A", targetId: "B", type: "calls" });

      const deps = graph.getDependencies("A");
      expect(deps).toHaveLength(1);
      expect(deps[0]).toEqual({ sourceId: "A", targetId: "B", type: "calls" });
    });

    it("removes a relationship", () => {
      const graph = createKnowledgeGraph(db);
      graph.addRelationship({ sourceId: "A", targetId: "B", type: "calls" });
      graph.removeRelationship("A", "B");

      expect(graph.getDependencies("A")).toHaveLength(0);
    });

    it("upsert replaces existing relationship type", () => {
      const graph = createKnowledgeGraph(db);
      graph.addRelationship({ sourceId: "A", targetId: "B", type: "calls" });
      graph.addRelationship({ sourceId: "A", targetId: "B", type: "inherits" });

      const deps = graph.getDependencies("A");
      expect(deps).toHaveLength(1);
      expect(deps[0].type).toBe("inherits");
    });
  });

  describe("getDependents", () => {
    it("returns symbols that depend on the target", () => {
      const graph = createKnowledgeGraph(db);
      graph.addRelationship({ sourceId: "A", targetId: "C", type: "calls" });
      graph.addRelationship({ sourceId: "B", targetId: "C", type: "uses" });

      const dependents = graph.getDependents("C");
      expect(dependents).toHaveLength(2);
      expect(dependents.map((d) => d.sourceId).sort()).toEqual(["A", "B"]);
    });
  });

  describe("getDependencies", () => {
    it("returns symbols that the source depends on", () => {
      const graph = createKnowledgeGraph(db);
      graph.addRelationship({ sourceId: "A", targetId: "B", type: "calls" });
      graph.addRelationship({ sourceId: "A", targetId: "C", type: "uses" });

      const deps = graph.getDependencies("A");
      expect(deps).toHaveLength(2);
      expect(deps.map((d) => d.targetId).sort()).toEqual(["B", "C"]);
    });
  });

  describe("getImpactRadius", () => {
    it("returns transitive dependents via BFS", () => {
      const graph = createKnowledgeGraph(db);
      graph.addRelationship({ sourceId: "Order", targetId: "Payment", type: "calls" });
      graph.addRelationship({ sourceId: "Payment", targetId: "Stripe", type: "calls" });

      const impact = graph.getImpactRadius("Stripe", 3);
      expect(impact).toContain("Payment");
      expect(impact).toContain("Order");
      expect(impact).not.toContain("Stripe");
    });

    it("respects maxDepth", () => {
      const graph = createKnowledgeGraph(db);
      graph.addRelationship({ sourceId: "A", targetId: "B", type: "calls" });
      graph.addRelationship({ sourceId: "B", targetId: "C", type: "calls" });
      graph.addRelationship({ sourceId: "C", targetId: "D", type: "calls" });

      const impact = graph.getImpactRadius("D", 2);
      expect(impact).toContain("C");
      expect(impact).toContain("B");
      expect(impact).not.toContain("A");
    });

    it("handles cycles without infinite loops", () => {
      const graph = createKnowledgeGraph(db);
      graph.addRelationship({ sourceId: "A", targetId: "B", type: "calls" });
      graph.addRelationship({ sourceId: "B", targetId: "C", type: "calls" });
      graph.addRelationship({ sourceId: "C", targetId: "A", type: "calls" });

      const impact = graph.getImpactRadius("A", 10);
      expect(impact).toContain("B");
      expect(impact).toContain("C");
      expect(impact).toHaveLength(2);
    });

    it("handles diamond dependencies", () => {
      const graph = createKnowledgeGraph(db);
      //   A → B → D
      //   A → C → D
      graph.addRelationship({ sourceId: "A", targetId: "D", type: "calls" });
      graph.addRelationship({ sourceId: "B", targetId: "D", type: "calls" });
      graph.addRelationship({ sourceId: "C", targetId: "D", type: "calls" });
      graph.addRelationship({ sourceId: "A", targetId: "B", type: "calls" });
      graph.addRelationship({ sourceId: "A", targetId: "C", type: "calls" });

      const impact = graph.getImpactRadius("D", 3);
      expect(impact).toContain("A");
      expect(impact).toContain("B");
      expect(impact).toContain("C");
    });

    it("returns empty for symbol with no dependents", () => {
      const graph = createKnowledgeGraph(db);
      graph.addRelationship({ sourceId: "A", targetId: "B", type: "calls" });

      const impact = graph.getImpactRadius("A", 3);
      expect(impact).toHaveLength(0);
    });
  });

  describe("rebuild", () => {
    it("rebuilds graph from symbol relationships", async () => {
      const graph = createKnowledgeGraph(db);
      graph.addRelationship({ sourceId: "old", targetId: "stale", type: "calls" });

      const symbols = [
        sym({ id: "s1", name: "Child", extends: "s2", implements: ["s3"], references: ["s4"] }),
        sym({ id: "s2", name: "Parent" }),
        sym({ id: "s3", name: "IFace", kind: "interface" }),
        sym({ id: "s4", name: "Helper" }),
      ];

      await graph.rebuild(symbols);

      expect(graph.getDependencies("old")).toHaveLength(0);

      const deps = graph.getDependencies("s1");
      expect(deps).toHaveLength(3);
      expect(deps.map((d) => d.type).sort()).toEqual(["implements", "inherits", "uses"]);
    });
  });
});
