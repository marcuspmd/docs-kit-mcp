import type Database from "better-sqlite3";
import type { ISymbolRepository } from "../../../domain/repositories/ISymbolRepository.js";
import type { CodeSymbol } from "../../../domain/entities/CodeSymbol.js";
import type { SymbolKindType } from "../../../domain/value-objects/SymbolKind.js";
import { SymbolMapper } from "../../../application/mappers/SymbolMapper.js";

interface SymbolRow {
  id: string;
  name: string;
  qualified_name: string | null;
  kind: string;
  file: string;
  start_line: number;
  end_line: number;
  parent: string | null;
  visibility: string | null;
  exported: number | null;
  language: string | null;
  doc_ref: string | null;
  summary: string | null;
  doc_comment: string | null;
  tags: string | null;
  domain: string | null;
  bounded_context: string | null;
  sym_extends: string | null;
  sym_implements: string | null;
  uses_traits: string | null;
  sym_references: string | null;
  referenced_by: string | null;
  layer: string | null;
  metrics: string | null;
  pattern: string | null;
  violations: string | null;
  deprecated: number | null;
  since: string | null;
  stability: string | null;
  generated: number | null;
  source: string | null;
  last_modified: string | null;
  signature: string | null;
  explanation: string | null;
  explanation_hash: string | null;
}

/**
 * SQLite Symbol Repository Implementation
 */
export class SqliteSymbolRepository implements ISymbolRepository {
  private readonly upsertStmt: Database.Statement;
  private readonly findByIdStmt: Database.Statement;
  private readonly findByNameStmt: Database.Statement;
  private readonly findAllStmt: Database.Statement;
  private readonly findByFileStmt: Database.Statement;
  private readonly findByKindStmt: Database.Statement;
  private readonly deleteByFileStmt: Database.Statement;
  private readonly clearStmt: Database.Statement;
  private readonly countStmt: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.upsertStmt = db.prepare(`
      INSERT OR REPLACE INTO symbols (
        id, name, qualified_name, kind, file, start_line, end_line, parent,
        visibility, exported, language, doc_ref, summary, doc_comment, tags, domain, bounded_context,
        sym_extends, sym_implements, uses_traits, sym_references, referenced_by, layer, metrics,
        pattern, violations, deprecated, since, stability, generated, source,
        last_modified, signature, explanation, explanation_hash
      ) VALUES (
        @id, @name, @qualified_name, @kind, @file, @start_line, @end_line, @parent,
        @visibility, @exported, @language, @doc_ref, @summary, @doc_comment, @tags, @domain, @bounded_context,
        @sym_extends, @sym_implements, @uses_traits, @sym_references, @referenced_by, @layer, @metrics,
        @pattern, @violations, @deprecated, @since, @stability, @generated, @source,
        @last_modified, @signature, @explanation, @explanation_hash
      )
    `);

    this.findByIdStmt = db.prepare("SELECT * FROM symbols WHERE id = ?");
    this.findByNameStmt = db.prepare("SELECT * FROM symbols WHERE name = ? OR qualified_name = ?");
    this.findAllStmt = db.prepare("SELECT * FROM symbols");
    this.findByFileStmt = db.prepare("SELECT * FROM symbols WHERE file = ?");
    this.findByKindStmt = db.prepare("SELECT * FROM symbols WHERE kind = ?");
    this.deleteByFileStmt = db.prepare("DELETE FROM symbols WHERE file = ?");
    this.clearStmt = db.prepare("DELETE FROM symbols");
    this.countStmt = db.prepare("SELECT COUNT(*) as count FROM symbols");
  }

  upsert(symbol: CodeSymbol): void {
    const data = SymbolMapper.toPersistence(symbol);
    this.upsertStmt.run(data);
  }

  upsertMany(symbols: CodeSymbol[]): void {
    const transaction = this.db.transaction((syms: CodeSymbol[]) => {
      for (const sym of syms) {
        this.upsert(sym);
      }
    });
    transaction(symbols);
  }

  findById(id: string): CodeSymbol | undefined {
    const row = this.findByIdStmt.get(id) as SymbolRow | undefined;
    return row ? SymbolMapper.toDomain(row) : undefined;
  }

  findByIds(ids: string[]): CodeSymbol[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => "?").join(",");
    const stmt = this.db.prepare(`SELECT * FROM symbols WHERE id IN (${placeholders})`);
    const rows = stmt.all(...ids) as SymbolRow[];
    return rows.map((row) => SymbolMapper.toDomain(row));
  }

  findByName(name: string): CodeSymbol[] {
    const rows = this.findByNameStmt.all(name, name) as SymbolRow[];
    return rows.map((row) => SymbolMapper.toDomain(row));
  }

  findAll(): CodeSymbol[] {
    const rows = this.findAllStmt.all() as SymbolRow[];
    return rows.map((row) => SymbolMapper.toDomain(row));
  }

  findByFile(file: string): CodeSymbol[] {
    const rows = this.findByFileStmt.all(file) as SymbolRow[];
    return rows.map((row) => SymbolMapper.toDomain(row));
  }

  findByKind(kind: SymbolKindType): CodeSymbol[] {
    const rows = this.findByKindStmt.all(kind) as SymbolRow[];
    return rows.map((row) => SymbolMapper.toDomain(row));
  }

  deleteByFile(file: string): void {
    this.deleteByFileStmt.run(file);
  }

  clear(): void {
    this.clearStmt.run();
  }

  count(): number {
    const row = this.countStmt.get() as { count: number };
    return row.count;
  }
}
