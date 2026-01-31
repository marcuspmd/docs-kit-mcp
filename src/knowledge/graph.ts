import type Database from "better-sqlite3";
import type { CodeSymbol, SymbolRelationship } from "../indexer/symbol.types.js";

export interface KnowledgeGraph {
  addRelationship(rel: SymbolRelationship): void;
  removeRelationship(sourceId: string, targetId: string): void;
  getDependents(symbolId: string): SymbolRelationship[];
  getDependencies(symbolId: string): SymbolRelationship[];
  getImpactRadius(symbolId: string, maxDepth?: number): string[];
  rebuild(symbols: CodeSymbol[]): Promise<void>;
}

export function createKnowledgeGraph(db: Database.Database): KnowledgeGraph {
  const insertStmt = db.prepare(
    "INSERT OR REPLACE INTO relationships (source_id, target_id, type) VALUES (?, ?, ?)",
  );
  const deleteStmt = db.prepare("DELETE FROM relationships WHERE source_id = ? AND target_id = ?");
  const dependentsStmt = db.prepare(
    "SELECT source_id, target_id, type FROM relationships WHERE target_id = ?",
  );
  const dependenciesStmt = db.prepare(
    "SELECT source_id, target_id, type FROM relationships WHERE source_id = ?",
  );
  const clearStmt = db.prepare("DELETE FROM relationships");

  function toRel(row: { source_id: string; target_id: string; type: string }): SymbolRelationship {
    return { sourceId: row.source_id, targetId: row.target_id, type: row.type };
  }

  return {
    addRelationship(rel) {
      insertStmt.run(rel.sourceId, rel.targetId, rel.type);
    },

    removeRelationship(sourceId, targetId) {
      deleteStmt.run(sourceId, targetId);
    },

    getDependents(symbolId) {
      const rows = dependentsStmt.all(symbolId) as Array<{
        source_id: string;
        target_id: string;
        type: string;
      }>;
      return rows.map(toRel);
    },

    getDependencies(symbolId) {
      const rows = dependenciesStmt.all(symbolId) as Array<{
        source_id: string;
        target_id: string;
        type: string;
      }>;
      return rows.map(toRel);
    },

    getImpactRadius(symbolId, maxDepth = 3) {
      const visited = new Set<string>();
      const queue: Array<{ id: string; depth: number }> = [{ id: symbolId, depth: 0 }];

      while (queue.length > 0) {
        const { id, depth } = queue.shift()!;
        if (visited.has(id)) continue;
        visited.add(id);

        if (depth >= maxDepth) continue;

        const dependents = dependentsStmt.all(id) as Array<{
          source_id: string;
          target_id: string;
          type: string;
        }>;
        for (const row of dependents) {
          if (!visited.has(row.source_id)) {
            queue.push({ id: row.source_id, depth: depth + 1 });
          }
        }
      }

      visited.delete(symbolId);
      return [...visited];
    },

    async rebuild(symbols) {
      clearStmt.run();

      const relTypes: Array<{ field: keyof CodeSymbol; type: string }> = [
        { field: "extends", type: "inherits" },
        { field: "implements", type: "implements" },
        { field: "references", type: "uses" },
      ];

      for (const sym of symbols) {
        for (const { field, type } of relTypes) {
          const value = sym[field];
          if (!value) continue;
          const targets = Array.isArray(value) ? value : [value];
          for (const targetId of targets) {
            insertStmt.run(sym.id, targetId as string, type);
          }
        }
      }
    },
  };
}
