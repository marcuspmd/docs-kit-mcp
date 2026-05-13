import type Database from "better-sqlite3";

export const CURRENT_SCHEMA_VERSION = 4;

const PR_REVIEW_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS pr_pull_requests (
  id          TEXT PRIMARY KEY,
  provider    TEXT NOT NULL,
  repository  TEXT NOT NULL,
  number      TEXT NOT NULL,
  title       TEXT,
  url         TEXT,
  author      TEXT,
  state       TEXT NOT NULL,
  base_ref    TEXT NOT NULL,
  head_ref    TEXT NOT NULL,
  base_sha    TEXT,
  head_sha    TEXT,
  created_at  TEXT,
  updated_at  TEXT,
  synced_at   TEXT,
  UNIQUE (provider, repository, number)
);

CREATE TABLE IF NOT EXISTS pr_review_runs (
  id                 TEXT PRIMARY KEY,
  pr_id              TEXT NOT NULL,
  status             TEXT NOT NULL,
  base_sha           TEXT,
  head_sha           TEXT,
  generated_at       TEXT NOT NULL,
  provider_review_id TEXT,
  summary            TEXT,
  error              TEXT,
  metadata           TEXT
);

CREATE TABLE IF NOT EXISTS pr_review_files (
  pr_id     TEXT NOT NULL,
  file_path TEXT NOT NULL,
  status    TEXT NOT NULL DEFAULT 'unviewed',
  viewer    TEXT,
  viewed_at TEXT,
  PRIMARY KEY (pr_id, file_path)
);

CREATE TABLE IF NOT EXISTS pr_review_threads (
  id                 TEXT PRIMARY KEY,
  pr_id              TEXT NOT NULL,
  run_id             TEXT,
  provider_thread_id TEXT,
  status             TEXT NOT NULL,
  file_path          TEXT NOT NULL,
  side               TEXT NOT NULL,
  line               INTEGER,
  original_line      INTEGER,
  start_line         INTEGER,
  end_line           INTEGER,
  diff_hunk          TEXT,
  symbol_id          TEXT,
  finding_id         TEXT,
  dedupe_key         TEXT,
  title              TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  resolved_at        TEXT,
  resolved_by        TEXT
);

CREATE TABLE IF NOT EXISTS pr_review_comments (
  id                  TEXT PRIMARY KEY,
  thread_id           TEXT NOT NULL,
  pr_id               TEXT NOT NULL,
  provider_comment_id TEXT,
  author              TEXT NOT NULL,
  body                TEXT NOT NULL,
  state               TEXT NOT NULL,
  is_draft            INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL,
  updated_at          TEXT
);

CREATE TABLE IF NOT EXISTS pr_review_submissions (
  id                 TEXT PRIMARY KEY,
  pr_id              TEXT NOT NULL,
  run_id             TEXT,
  provider_review_id TEXT,
  author             TEXT NOT NULL,
  verdict            TEXT NOT NULL,
  body               TEXT,
  state              TEXT NOT NULL,
  created_at         TEXT NOT NULL,
  submitted_at       TEXT,
  updated_at         TEXT,
  error              TEXT
);

CREATE TABLE IF NOT EXISTS pr_reviewers (
  pr_id       TEXT NOT NULL,
  username    TEXT NOT NULL,
  role        TEXT NOT NULL,
  status      TEXT NOT NULL,
  reviewed_at TEXT,
  PRIMARY KEY (pr_id, username)
);

CREATE TABLE IF NOT EXISTS pr_review_suggestions (
  id         TEXT PRIMARY KEY,
  thread_id  TEXT NOT NULL,
  comment_id TEXT,
  body       TEXT NOT NULL,
  state      TEXT NOT NULL,
  created_at TEXT NOT NULL,
  applied_at TEXT
);

CREATE TABLE IF NOT EXISTS pr_review_history (
  id          TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  pr_id       TEXT NOT NULL,
  changed_at  TEXT NOT NULL DEFAULT (datetime('now')),
  field       TEXT NOT NULL,
  old_value   TEXT,
  new_value   TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'user'
);
`;

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
  id               TEXT PRIMARY KEY,
  type             TEXT NOT NULL,
  target           TEXT NOT NULL,
  reason           TEXT NOT NULL,
  suggested_action TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'active',
  notes            TEXT,
  first_seen_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reaper_finding_history (
  id          TEXT PRIMARY KEY,
  finding_id  TEXT NOT NULL,
  changed_at  TEXT NOT NULL DEFAULT (datetime('now')),
  field       TEXT NOT NULL,
  old_value   TEXT,
  new_value   TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'user'
);

${PR_REVIEW_TABLES_SQL}
`;

const INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file);
CREATE INDEX IF NOT EXISTS idx_symbols_kind ON symbols(kind);
CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
CREATE INDEX IF NOT EXISTS idx_symbols_qualified_name ON symbols(qualified_name);
CREATE INDEX IF NOT EXISTS idx_symbols_layer ON symbols(layer);
CREATE INDEX IF NOT EXISTS idx_doc_mappings_path ON doc_mappings(doc_path);
CREATE INDEX IF NOT EXISTS idx_reaper_findings_status ON reaper_findings(status);
CREATE INDEX IF NOT EXISTS idx_reaper_history_finding ON reaper_finding_history(finding_id);
CREATE INDEX IF NOT EXISTS idx_pr_pull_requests_lookup ON pr_pull_requests(provider, repository, number);
CREATE INDEX IF NOT EXISTS idx_pr_review_runs_pr ON pr_review_runs(pr_id);
CREATE INDEX IF NOT EXISTS idx_pr_review_files_pr ON pr_review_files(pr_id);
CREATE INDEX IF NOT EXISTS idx_pr_review_threads_pr ON pr_review_threads(pr_id);
CREATE INDEX IF NOT EXISTS idx_pr_review_threads_dedupe ON pr_review_threads(pr_id, dedupe_key);
CREATE INDEX IF NOT EXISTS idx_pr_review_comments_thread ON pr_review_comments(thread_id);
CREATE INDEX IF NOT EXISTS idx_pr_review_submissions_pr ON pr_review_submissions(pr_id);
CREATE INDEX IF NOT EXISTS idx_pr_review_history_entity ON pr_review_history(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_pr_review_history_pr ON pr_review_history(pr_id);
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
  {
    version: 3,
    up(db) {
      // Recreate reaper_findings with new schema (data is ephemeral — safe to drop)
      if (tableExists(db, "reaper_findings") && !columnExists(db, "reaper_findings", "id")) {
        db.exec("DROP TABLE reaper_findings");
      }
      db.exec(`
        CREATE TABLE IF NOT EXISTS reaper_findings (
          id               TEXT PRIMARY KEY,
          type             TEXT NOT NULL,
          target           TEXT NOT NULL,
          reason           TEXT NOT NULL,
          suggested_action TEXT NOT NULL,
          status           TEXT NOT NULL DEFAULT 'active',
          notes            TEXT,
          first_seen_at    TEXT NOT NULL DEFAULT (datetime('now')),
          last_seen_at     TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS reaper_finding_history (
          id          TEXT PRIMARY KEY,
          finding_id  TEXT NOT NULL,
          changed_at  TEXT NOT NULL DEFAULT (datetime('now')),
          field       TEXT NOT NULL,
          old_value   TEXT,
          new_value   TEXT NOT NULL,
          source      TEXT NOT NULL DEFAULT 'user'
        )
      `);
      db.exec("CREATE INDEX IF NOT EXISTS idx_reaper_findings_status ON reaper_findings(status)");
      db.exec(
        "CREATE INDEX IF NOT EXISTS idx_reaper_history_finding ON reaper_finding_history(finding_id)",
      );
    },
  },
  {
    version: 4,
    up(db) {
      db.exec(PR_REVIEW_TABLES_SQL);
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
