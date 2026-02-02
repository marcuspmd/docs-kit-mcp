import Database from "better-sqlite3";
import type { CodeSymbol, SymbolKind, SymbolRelationship } from "../indexer/symbol.types.js";

/* ================== Database ================== */

export interface DbOptions {
  path?: string;
  inMemory?: boolean;
}

export function createDatabase(options?: DbOptions): Database.Database {
  const db = new Database(
    options?.inMemory ? ":memory:" : (options?.path ?? "src/storage/index.db"),
  );
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS symbols (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  qualified_name    TEXT,
  kind              TEXT NOT NULL,
  file              TEXT NOT NULL,
  start_line        INTEGER NOT NULL,
  end_line          INTEGER NOT NULL,
  parent            TEXT,
  visibility        TEXT,
  exported          INTEGER,
  language          TEXT,
  doc_ref           TEXT,
  summary           TEXT,
  doc_comment       TEXT,
  tags              TEXT,
  domain            TEXT,
  bounded_context   TEXT,
  sym_extends       TEXT,
  sym_implements    TEXT,
  uses_traits       TEXT,
  sym_references    TEXT,
  referenced_by     TEXT,
  layer             TEXT,
  metrics           TEXT,
  pattern           TEXT,
  violations        TEXT,
  deprecated        INTEGER,
  since             TEXT,
  stability         TEXT,
  generated         INTEGER,
  source            TEXT,
  last_modified     TEXT,
  signature         TEXT,
  explanation       TEXT,
  explanation_hash  TEXT
);

CREATE TABLE IF NOT EXISTS relationships (
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  type      TEXT NOT NULL,
  PRIMARY KEY (source_id, target_id)
);

CREATE TABLE IF NOT EXISTS doc_mappings (
  symbol_name TEXT NOT NULL,
  doc_path    TEXT NOT NULL,
  section     TEXT,
  updated_at  TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (symbol_name, doc_path)
);

CREATE TABLE IF NOT EXISTS rag_chunks (
  hash            TEXT PRIMARY KEY,
  content         TEXT NOT NULL,
  source          TEXT NOT NULL,
  symbol_id       TEXT,
  vector          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS file_hashes (
  file_path       TEXT PRIMARY KEY,
  content_hash    TEXT NOT NULL,
  last_indexed_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS patterns (
  kind        TEXT NOT NULL,
  symbols     TEXT NOT NULL,
  confidence  REAL NOT NULL,
  violations  TEXT
);

CREATE TABLE IF NOT EXISTS arch_violations (
  rule      TEXT NOT NULL,
  file      TEXT NOT NULL,
  symbol_id TEXT,
  message   TEXT NOT NULL,
  severity  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reaper_findings (
  type            TEXT NOT NULL,
  target          TEXT NOT NULL,
  reason          TEXT NOT NULL,
  suggested_action TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file);
CREATE INDEX IF NOT EXISTS idx_symbols_kind ON symbols(kind);
CREATE INDEX IF NOT EXISTS idx_doc_mappings_path ON doc_mappings(doc_path);
`;

export function initializeSchema(db: Database.Database): void {
  db.exec(SCHEMA_SQL);
  // Migrate existing DBs: add doc_comment to symbols if missing
  try {
    const info = db.prepare("PRAGMA table_info(symbols)").all() as Array<{ name: string }>;
    if (!info.some((r) => r.name === "doc_comment")) {
      db.prepare("ALTER TABLE symbols ADD COLUMN doc_comment TEXT").run();
    }
    if (!info.some((r) => r.name === "explanation")) {
      db.prepare("ALTER TABLE symbols ADD COLUMN explanation TEXT").run();
    }
    if (!info.some((r) => r.name === "explanation_hash")) {
      db.prepare("ALTER TABLE symbols ADD COLUMN explanation_hash TEXT").run();
    }
  } catch {
    // Table may not exist yet (fresh DB)
  }
}

/* ================== SymbolRepository ================== */

export interface SymbolRepository {
  upsert(symbol: CodeSymbol): void;
  findById(id: string): CodeSymbol | undefined;
  findByIds(ids: string[]): CodeSymbol[];
  findByName(name: string): CodeSymbol[];
  findAll(): CodeSymbol[];
  findByFile(file: string): CodeSymbol[];
  findByKind(kind: SymbolKind): CodeSymbol[];
  deleteByFile(file: string): void;
}

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

function parseJsonArray(value: string | null): string[] | undefined {
  return value ? JSON.parse(value) : undefined;
}

function toBool(value: number | null): boolean | undefined {
  return value !== null ? value === 1 : undefined;
}

function rowToSymbol(row: SymbolRow): CodeSymbol {
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
      const toJson = (v: unknown) => (v != null ? JSON.stringify(v) : null);
      const toBit = (v: boolean | undefined) => (v != null ? (v ? 1 : 0) : null);

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

/* ================== FileHashRepository ================== */

export interface FileHashRepository {
  get(filePath: string): { contentHash: string; lastIndexedAt: string } | undefined;
  upsert(filePath: string, contentHash: string): void;
  getAll(): Array<{ filePath: string; contentHash: string }>;
  delete(filePath: string): void;
  clear(): void;
}

export function createFileHashRepository(db: Database.Database): FileHashRepository {
  const getStmt = db.prepare(
    "SELECT content_hash, last_indexed_at FROM file_hashes WHERE file_path = ?",
  );
  const upsertStmt = db.prepare(
    "INSERT OR REPLACE INTO file_hashes (file_path, content_hash, last_indexed_at) VALUES (?, ?, datetime('now'))",
  );
  const getAllStmt = db.prepare("SELECT file_path, content_hash FROM file_hashes");
  const deleteStmt = db.prepare("DELETE FROM file_hashes WHERE file_path = ?");
  const clearStmt = db.prepare("DELETE FROM file_hashes");

  return {
    get(filePath) {
      const row = getStmt.get(filePath) as
        | { content_hash: string; last_indexed_at: string }
        | undefined;
      return row
        ? { contentHash: row.content_hash, lastIndexedAt: row.last_indexed_at }
        : undefined;
    },
    upsert(filePath, contentHash) {
      upsertStmt.run(filePath, contentHash);
    },
    getAll() {
      const rows = getAllStmt.all() as Array<{ file_path: string; content_hash: string }>;
      return rows.map((r) => ({ filePath: r.file_path, contentHash: r.content_hash }));
    },
    delete(filePath) {
      deleteStmt.run(filePath);
    },
    clear() {
      clearStmt.run();
    },
  };
}

/* ================== RelationshipRepository ================== */

export interface RelationshipRow {
  source_id: string;
  target_id: string;
  type: string;
}

/** Map storage RelationshipRow to SymbolRelationship for analyzers and generators. */
export function relationshipRowsToSymbolRelationships(
  rows: RelationshipRow[],
): SymbolRelationship[] {
  return rows.map((r) => ({
    sourceId: r.source_id,
    targetId: r.target_id,
    type: r.type as SymbolRelationship["type"],
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

/* ================== Patterns (replace-all for site generator) ================== */

export interface PatternRowForInsert {
  kind: string;
  symbols: string[];
  confidence: number;
  violations: string[];
}

export function replaceAllPatterns(db: Database.Database, patterns: PatternRowForInsert[]): void {
  db.prepare("DELETE FROM patterns").run();
  const insertStmt = db.prepare(
    "INSERT INTO patterns (kind, symbols, confidence, violations) VALUES (?, ?, ?, ?)",
  );
  for (const p of patterns) {
    insertStmt.run(
      p.kind,
      JSON.stringify(p.symbols),
      p.confidence,
      p.violations.length > 0 ? JSON.stringify(p.violations) : null,
    );
  }
}

/* ================== Arch violations (replace-all for site) ================== */

export interface ArchViolationRow {
  rule: string;
  file: string;
  symbol_id: string | null;
  message: string;
  severity: string;
}

export function replaceAllArchViolations(
  db: Database.Database,
  violations: ArchViolationRow[],
): void {
  db.prepare("DELETE FROM arch_violations").run();
  const insertStmt = db.prepare(
    "INSERT INTO arch_violations (rule, file, symbol_id, message, severity) VALUES (?, ?, ?, ?, ?)",
  );
  for (const v of violations) {
    insertStmt.run(v.rule, v.file, v.symbol_id ?? null, v.message, v.severity);
  }
}

/* ================== Reaper findings (replace-all for site) ================== */

export interface ReaperFindingRow {
  type: string;
  target: string;
  reason: string;
  suggested_action: string;
}

export function replaceAllReaperFindings(
  db: Database.Database,
  findings: ReaperFindingRow[],
): void {
  db.prepare("DELETE FROM reaper_findings").run();
  const insertStmt = db.prepare(
    "INSERT INTO reaper_findings (type, target, reason, suggested_action) VALUES (?, ?, ?, ?)",
  );
  for (const f of findings) {
    insertStmt.run(f.type, f.target, f.reason, f.suggested_action);
  }
}
