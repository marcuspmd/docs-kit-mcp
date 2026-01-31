import { createReaper } from "../src/governance/reaper.js";
import { createKnowledgeGraph } from "../src/knowledge/graph.js";
import { createDatabase, initializeSchema } from "../src/storage/db.js";
import type { CodeSymbol } from "../src/indexer/symbol.types.js";
import type { DocMapping } from "../src/docs/docRegistry.js";
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

describe("Reaper", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createDatabase({ inMemory: true });
    initializeSchema(db);
  });

  afterEach(() => {
    db.close();
  });

  describe("dead_code", () => {
    it("flags symbols with no incoming references", () => {
      const graph = createKnowledgeGraph(db);
      const symbols = [
        sym({ id: "a", name: "UsedService" }),
        sym({ id: "b", name: "DeadUtil" }),
      ];
      graph.addRelationship({ sourceId: "x", targetId: "a", type: "calls" });

      const reaper = createReaper();
      const findings = reaper.scan(symbols, graph, []);

      const dead = findings.filter((f) => f.type === "dead_code");
      expect(dead).toHaveLength(1);
      expect(dead[0].target).toBe("b");
      expect(dead[0].reason).toContain("DeadUtil");
      expect(dead[0].suggestedAction).toBe("review");
    });

    it("skips child symbols (methods)", () => {
      const graph = createKnowledgeGraph(db);
      const symbols = [
        sym({ id: "c1", name: "MyClass" }),
        sym({ id: "m1", name: "myMethod", kind: "method", parent: "c1" }),
      ];
      graph.addRelationship({ sourceId: "x", targetId: "c1", type: "calls" });

      const reaper = createReaper();
      const findings = reaper.scan(symbols, graph, []);

      expect(findings.filter((f) => f.type === "dead_code")).toHaveLength(0);
    });

    it("skips entry-point kinds (test, controller, listener, etc.)", () => {
      const graph = createKnowledgeGraph(db);
      const symbols = [
        sym({ id: "t1", name: "OrderTest", kind: "test" }),
        sym({ id: "c1", name: "OrderCtrl", kind: "controller" }),
        sym({ id: "l1", name: "OrderListener", kind: "listener" }),
      ];

      const reaper = createReaper();
      const findings = reaper.scan(symbols, graph, []);

      expect(findings.filter((f) => f.type === "dead_code")).toHaveLength(0);
    });

    it("skips symbols that are parents of other symbols", () => {
      const graph = createKnowledgeGraph(db);
      const symbols = [
        sym({ id: "c1", name: "ParentClass" }),
        sym({ id: "m1", name: "child", kind: "method", parent: "c1" }),
      ];

      const reaper = createReaper();
      const findings = reaper.scan(symbols, graph, []);

      expect(findings.filter((f) => f.type === "dead_code")).toHaveLength(0);
    });
  });

  describe("orphan_doc", () => {
    it("flags doc mappings pointing to non-existent symbols", () => {
      const graph = createKnowledgeGraph(db);
      const symbols = [sym({ id: "a", name: "ExistingService" })];
      const mappings: DocMapping[] = [
        { symbolName: "ExistingService", docPath: "docs/existing.md" },
        { symbolName: "LegacyService", docPath: "docs/legacy.md" },
      ];

      const reaper = createReaper();
      const findings = reaper.scan(symbols, graph, mappings);

      const orphans = findings.filter((f) => f.type === "orphan_doc");
      expect(orphans).toHaveLength(1);
      expect(orphans[0].target).toBe("docs/legacy.md");
      expect(orphans[0].reason).toContain("LegacyService");
      expect(orphans[0].suggestedAction).toBe("update");
    });

    it("matches by symbol id as well", () => {
      const graph = createKnowledgeGraph(db);
      const symbols = [sym({ id: "abc123", name: "Foo" })];
      const mappings: DocMapping[] = [
        { symbolName: "abc123", docPath: "docs/foo.md" },
      ];

      const reaper = createReaper();
      const findings = reaper.scan(symbols, graph, mappings);

      expect(findings.filter((f) => f.type === "orphan_doc")).toHaveLength(0);
    });

    it("returns empty when all mappings are valid", () => {
      const graph = createKnowledgeGraph(db);
      const symbols = [
        sym({ id: "a", name: "ServiceA" }),
        sym({ id: "b", name: "ServiceB" }),
      ];
      const mappings: DocMapping[] = [
        { symbolName: "ServiceA", docPath: "docs/a.md" },
        { symbolName: "ServiceB", docPath: "docs/b.md" },
      ];

      const reaper = createReaper();
      const findings = reaper.scan(symbols, graph, mappings);

      expect(findings.filter((f) => f.type === "orphan_doc")).toHaveLength(0);
    });
  });

  describe("combined scan", () => {
    it("returns both dead code and orphan doc findings", () => {
      const graph = createKnowledgeGraph(db);
      const symbols = [
        sym({ id: "a", name: "AliveService" }),
        sym({ id: "b", name: "DeadHelper" }),
      ];
      graph.addRelationship({ sourceId: "x", targetId: "a", type: "calls" });

      const mappings: DocMapping[] = [
        { symbolName: "AliveService", docPath: "docs/alive.md" },
        { symbolName: "GhostService", docPath: "docs/ghost.md" },
      ];

      const reaper = createReaper();
      const findings = reaper.scan(symbols, graph, mappings);

      expect(findings.filter((f) => f.type === "dead_code")).toHaveLength(1);
      expect(findings.filter((f) => f.type === "orphan_doc")).toHaveLength(1);
    });

    it("returns empty when codebase is clean", () => {
      const graph = createKnowledgeGraph(db);
      const symbols = [sym({ id: "a", name: "Svc", kind: "controller" })];
      const mappings: DocMapping[] = [
        { symbolName: "Svc", docPath: "docs/svc.md" },
      ];

      const reaper = createReaper();
      const findings = reaper.scan(symbols, graph, mappings);

      expect(findings).toHaveLength(0);
    });
  });
});
