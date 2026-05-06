import type Database from "better-sqlite3";
import type { SymbolRelationship } from "../indexer/symbol.types.js";

export interface RelationshipRow {
  source_id: string;
  target_id: string;
  type: string;
}

export function relationshipRowsToSymbolRelationships(
  rows: RelationshipRow[],
): SymbolRelationship[] {
  return rows.map((row) => ({
    sourceId: row.source_id,
    targetId: row.target_id,
    type: row.type as SymbolRelationship["type"],
  }));
}

export interface RelationshipRepository {
  upsert(sourceId: string, targetId: string, type: string): void;
  findBySource(sourceId: string): RelationshipRow[];
  findByTarget(targetId: string): RelationshipRow[];
  findAll(): RelationshipRow[];
  deleteBySource(sourceId: string): void;
}

export function createRelationshipRepository(db: Database.Database): RelationshipRepository {
  const upsertStmt = db.prepare(
    "INSERT OR REPLACE INTO relationships (source_id, target_id, type) VALUES (?, ?, ?)",
  );
  const findBySourceStmt = db.prepare("SELECT * FROM relationships WHERE source_id = ?");
  const findByTargetStmt = db.prepare("SELECT * FROM relationships WHERE target_id = ?");
  const findAllStmt = db.prepare("SELECT * FROM relationships");
  const deleteBySourceStmt = db.prepare("DELETE FROM relationships WHERE source_id = ?");

  return {
    upsert(sourceId, targetId, type) {
      upsertStmt.run(sourceId, targetId, type);
    },
    findBySource(sourceId) {
      return findBySourceStmt.all(sourceId) as RelationshipRow[];
    },
    findByTarget(targetId) {
      return findByTargetStmt.all(targetId) as RelationshipRow[];
    },
    findAll() {
      return findAllStmt.all() as RelationshipRow[];
    },
    deleteBySource(sourceId) {
      deleteBySourceStmt.run(sourceId);
    },
  };
}
