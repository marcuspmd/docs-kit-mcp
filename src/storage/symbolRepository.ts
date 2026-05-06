import type Database from "better-sqlite3";
import type { CodeSymbol, Layer, SymbolKind } from "../indexer/symbol.types.js";

export interface SymbolRepository {
  upsert(symbol: CodeSymbol): void;
  findById(id: string): CodeSymbol | undefined;
  findByIds(ids: string[]): CodeSymbol[];
  search(opts: { query?: string; kind?: SymbolKind; layer?: Layer; limit?: number }): CodeSymbol[];
  findByName(name: string): CodeSymbol[];
  findAll(): CodeSymbol[];
  findByFile(file: string): CodeSymbol[];
  findByKind(kind: SymbolKind): CodeSymbol[];
  deleteByFile(file: string): void;
}

export interface SymbolRow {
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

function parseJsonArray(value: string | null): string[] | undefined {
  return value ? JSON.parse(value) : undefined;
}

function toBool(value: number | null): boolean | undefined {
  return value !== null ? value === 1 : undefined;
}

export function rowToSymbol(row: SymbolRow): CodeSymbol {
  return {
    id: row.id,
    name: row.name,
    qualifiedName: row.qualified_name ?? undefined,
    kind: row.kind as SymbolKind,
    file: row.file,
    startLine: row.start_line,
    endLine: row.end_line,
    parent: row.parent ?? undefined,
    visibility: (row.visibility as CodeSymbol["visibility"]) ?? undefined,
    exported: toBool(row.exported),
    language: (row.language as CodeSymbol["language"]) ?? undefined,
    docRef: row.doc_ref ?? undefined,
    summary: row.summary ?? undefined,
    docComment: row.doc_comment ?? undefined,
    tags: parseJsonArray(row.tags),
    domain: row.domain ?? undefined,
    boundedContext: row.bounded_context ?? undefined,
    extends: row.sym_extends ?? undefined,
    implements: parseJsonArray(row.sym_implements),
    usesTraits: parseJsonArray(row.uses_traits),
    references: parseJsonArray(row.sym_references),
    referencedBy: parseJsonArray(row.referenced_by),
    layer: (row.layer as CodeSymbol["layer"]) ?? undefined,
    metrics: row.metrics ? JSON.parse(row.metrics) : undefined,
    pattern: row.pattern ?? undefined,
    violations: parseJsonArray(row.violations),
    deprecated: toBool(row.deprecated),
    since: row.since ?? undefined,
    stability: (row.stability as CodeSymbol["stability"]) ?? undefined,
    generated: toBool(row.generated),
    source: (row.source as CodeSymbol["source"]) ?? undefined,
    lastModified: row.last_modified ? new Date(row.last_modified) : undefined,
    signature: row.signature ?? undefined,
    explanation: row.explanation ?? undefined,
    explanationHash: row.explanation_hash ?? undefined,
  };
}

export function createSymbolRepository(db: Database.Database): SymbolRepository {
  const upsertStmt = db.prepare(`
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

  const findByIdStmt = db.prepare("SELECT * FROM symbols WHERE id = ?");

  const findByNameStmt = db.prepare("SELECT * FROM symbols WHERE name = ? OR qualified_name = ?");
  const findAllStmt = db.prepare("SELECT * FROM symbols");
  const findByFileStmt = db.prepare("SELECT * FROM symbols WHERE file = ?");
  const findByKindStmt = db.prepare("SELECT * FROM symbols WHERE kind = ?");
  const deleteByFileStmt = db.prepare("DELETE FROM symbols WHERE file = ?");

  return {
    upsert(symbol: CodeSymbol): void {
      const toJson = (value: unknown) => (value != null ? JSON.stringify(value) : null);
      const toBit = (value: boolean | undefined) => (value != null ? (value ? 1 : 0) : null);

      upsertStmt.run({
        id: symbol.id,
        name: symbol.name,
        qualified_name: symbol.qualifiedName ?? null,
        kind: symbol.kind,
        file: symbol.file,
        start_line: symbol.startLine,
        end_line: symbol.endLine,
        parent: symbol.parent ?? null,
        visibility: symbol.visibility ?? null,
        exported: toBit(symbol.exported),
        language: symbol.language ?? null,
        doc_ref: symbol.docRef ?? null,
        summary: symbol.summary ?? null,
        doc_comment: symbol.docComment ?? null,
        tags: toJson(symbol.tags),
        domain: symbol.domain ?? null,
        bounded_context: symbol.boundedContext ?? null,
        sym_extends: symbol.extends ?? null,
        sym_implements: toJson(symbol.implements),
        uses_traits: toJson(symbol.usesTraits),
        sym_references: toJson(symbol.references),
        referenced_by: toJson(symbol.referencedBy),
        layer: symbol.layer ?? null,
        metrics: toJson(symbol.metrics),
        pattern: symbol.pattern ?? null,
        violations: toJson(symbol.violations),
        deprecated: toBit(symbol.deprecated),
        since: symbol.since ?? null,
        stability: symbol.stability ?? null,
        generated: toBit(symbol.generated),
        source: symbol.source ?? null,
        last_modified: symbol.lastModified?.toISOString() ?? null,
        signature: symbol.signature ?? null,
        explanation: symbol.explanation ?? null,
        explanation_hash: symbol.explanationHash ?? null,
      });
    },

    findById(id: string): CodeSymbol | undefined {
      const row = findByIdStmt.get(id) as SymbolRow | undefined;
      return row ? rowToSymbol(row) : undefined;
    },

    findByIds(ids: string[]): CodeSymbol[] {
      if (ids.length === 0) return [];
      const placeholders = ids.map(() => "?").join(",");
      const stmt = db.prepare(`SELECT * FROM symbols WHERE id IN (${placeholders})`);
      const rows = stmt.all(...ids) as SymbolRow[];
      return rows.map(rowToSymbol);
    },

    search(opts: {
      query?: string;
      kind?: SymbolKind;
      layer?: Layer;
      limit?: number;
    }): CodeSymbol[] {
      const clauses: string[] = [];
      const params: Record<string, string | number> = {};
      const query = opts.query?.trim();

      if (query) {
        clauses.push("(name LIKE @query OR qualified_name LIKE @query)");
        params.query = `%${query}%`;
      }

      if (opts.kind) {
        clauses.push("kind = @kind");
        params.kind = opts.kind;
      }

      if (opts.layer) {
        clauses.push("layer = @layer");
        params.layer = opts.layer;
      }

      params.limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
      const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
      const rows = db
        .prepare(`SELECT * FROM symbols ${where} ORDER BY file ASC, start_line ASC LIMIT @limit`)
        .all(params) as SymbolRow[];
      return rows.map(rowToSymbol);
    },

    findByName(name: string): CodeSymbol[] {
      const rows = findByNameStmt.all(name, name) as SymbolRow[];
      return rows.map(rowToSymbol);
    },

    findAll(): CodeSymbol[] {
      const rows = findAllStmt.all() as SymbolRow[];
      return rows.map(rowToSymbol);
    },

    findByFile(file: string): CodeSymbol[] {
      const rows = findByFileStmt.all(file) as SymbolRow[];
      return rows.map(rowToSymbol);
    },

    findByKind(kind: SymbolKind): CodeSymbol[] {
      const rows = findByKindStmt.all(kind) as SymbolRow[];
      return rows.map(rowToSymbol);
    },

    deleteByFile(file: string): void {
      deleteByFileStmt.run(file);
    },
  };
}
