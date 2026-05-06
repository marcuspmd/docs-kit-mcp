import type Database from "better-sqlite3";

export const CURRENT_SCHEMA_VERSION = 2;

const CREATE_TABLES_SQL = `
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
  vector          TEXT NOT NULL,
  vector_blob     BLOB
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
`;

const INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file);
CREATE INDEX IF NOT EXISTS idx_symbols_kind ON symbols(kind);
CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
CREATE INDEX IF NOT EXISTS idx_symbols_qualified_name ON symbols(qualified_name);
CREATE INDEX IF NOT EXISTS idx_symbols_layer ON symbols(layer);
CREATE INDEX IF NOT EXISTS idx_doc_mappings_path ON doc_mappings(doc_path);
`;

export const SCHEMA_SQL = `${CREATE_TABLES_SQL}\n${INDEX_SQL}`;

const SYMBOL_COLUMNS: Array<{ name: string; type: string }> = [
  { name: "qualified_name", type: "TEXT" },
  { name: "parent", type: "TEXT" },
  { name: "visibility", type: "TEXT" },
  { name: "exported", type: "INTEGER" },
  { name: "language", type: "TEXT" },
  { name: "doc_ref", type: "TEXT" },
  { name: "summary", type: "TEXT" },
  { name: "doc_comment", type: "TEXT" },
  { name: "tags", type: "TEXT" },
  { name: "domain", type: "TEXT" },
  { name: "bounded_context", type: "TEXT" },
  { name: "sym_extends", type: "TEXT" },
  { name: "sym_implements", type: "TEXT" },
  { name: "uses_traits", type: "TEXT" },
  { name: "sym_references", type: "TEXT" },
  { name: "referenced_by", type: "TEXT" },
  { name: "layer", type: "TEXT" },
  { name: "metrics", type: "TEXT" },
  { name: "pattern", type: "TEXT" },
  { name: "violations", type: "TEXT" },
  { name: "deprecated", type: "INTEGER" },
  { name: "since", type: "TEXT" },
  { name: "stability", type: "TEXT" },
  { name: "generated", type: "INTEGER" },
  { name: "source", type: "TEXT" },
  { name: "last_modified", type: "TEXT" },
  { name: "signature", type: "TEXT" },
  { name: "explanation", type: "TEXT" },
  { name: "explanation_hash", type: "TEXT" },
];

interface SchemaMigration {
  version: number;
  up(db: Database.Database): void;
}

const MIGRATIONS: SchemaMigration[] = [
  {
    version: 1,
    up(db) {
      db.exec(CREATE_TABLES_SQL);
    },
  },
  {
    version: 2,
    up(db) {
      for (const column of SYMBOL_COLUMNS) {
        addColumnIfMissing(db, "symbols", column.name, column.type);
      }
      addColumnIfMissing(db, "rag_chunks", "vector_blob", "BLOB");
    },
  },
];

export function initializeSchema(db: Database.Database): void {
  db.exec(CREATE_TABLES_SQL);

  let schemaVersion = getSchemaVersion(db);
  for (const migration of MIGRATIONS) {
    if (migration.version <= schemaVersion) continue;
    migration.up(db);
    setSchemaVersion(db, migration.version);
    schemaVersion = migration.version;
  }

  db.exec(INDEX_SQL);
}

function getSchemaVersion(db: Database.Database): number {
  return Number(db.pragma("user_version", { simple: true }) ?? 0);
}

function setSchemaVersion(db: Database.Database, version: number): void {
  db.pragma(`user_version = ${version}`);
}

function addColumnIfMissing(
  db: Database.Database,
  tableName: string,
  columnName: string,
  columnType: string,
): void {
  if (!tableExists(db, tableName)) return;
  if (columnExists(db, tableName, columnName)) return;
  db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`).run();
}

function tableExists(db: Database.Database, tableName: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName);
  return row !== undefined;
}

function columnExists(db: Database.Database, tableName: string, columnName: string): boolean {
  const info = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return info.some((row) => row.name === columnName);
}
