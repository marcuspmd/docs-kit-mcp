import type Database from "better-sqlite3";
import type { IRelationshipRepository } from "../../../domain/repositories/IRelationshipRepository.js";
import { SymbolRelationship } from "../../../domain/entities/SymbolRelationship.js";

interface RelationshipRow {
  source_id: string;
  target_id: string;
  type: string;
}

/**
 * SQLite Relationship Repository Implementation
 */
export class SqliteRelationshipRepository implements IRelationshipRepository {
  private readonly upsertStmt: Database.Statement;
  private readonly findBySourceStmt: Database.Statement;
  private readonly findByTargetStmt: Database.Statement;
  private readonly findAllStmt: Database.Statement;
  private readonly deleteBySourceStmt: Database.Statement;
  private readonly clearStmt: Database.Statement;
  private readonly countStmt: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.upsertStmt = db.prepare(
      "INSERT OR REPLACE INTO relationships (source_id, target_id, type) VALUES (?, ?, ?)",
    );
    this.findBySourceStmt = db.prepare("SELECT * FROM relationships WHERE source_id = ?");
    this.findByTargetStmt = db.prepare("SELECT * FROM relationships WHERE target_id = ?");
    this.findAllStmt = db.prepare("SELECT * FROM relationships");
    this.deleteBySourceStmt = db.prepare("DELETE FROM relationships WHERE source_id = ?");
    this.clearStmt = db.prepare("DELETE FROM relationships");
    this.countStmt = db.prepare("SELECT COUNT(*) as count FROM relationships");
  }

  private rowToDomain(row: RelationshipRow): SymbolRelationship {
    return SymbolRelationship.fromPersistence({
      sourceId: row.source_id,
      targetId: row.target_id,
      type: row.type,
    });
  }

  upsert(relationship: SymbolRelationship): void {
    this.upsertStmt.run(relationship.sourceId, relationship.targetId, relationship.type);
  }

  upsertMany(relationships: SymbolRelationship[]): void {
    const transaction = this.db.transaction((rels: SymbolRelationship[]) => {
      for (const rel of rels) {
        this.upsert(rel);
      }
    });
    transaction(relationships);
  }

  findBySource(sourceId: string): SymbolRelationship[] {
    const rows = this.findBySourceStmt.all(sourceId) as RelationshipRow[];
    return rows.map((row) => this.rowToDomain(row));
  }

  findByTarget(targetId: string): SymbolRelationship[] {
    const rows = this.findByTargetStmt.all(targetId) as RelationshipRow[];
    return rows.map((row) => this.rowToDomain(row));
  }

  findAll(): SymbolRelationship[] {
    const rows = this.findAllStmt.all() as RelationshipRow[];
    return rows.map((row) => this.rowToDomain(row));
  }

  deleteBySource(sourceId: string): void {
    this.deleteBySourceStmt.run(sourceId);
  }

  clear(): void {
    this.clearStmt.run();
  }

  count(): number {
    const row = this.countStmt.get() as { count: number };
    return row.count;
  }
}
