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
  tags              TEXT,       -- JSON array
  domain            TEXT,
  bounded_context   TEXT,
  sym_extends       TEXT,
  sym_implements    TEXT,       -- JSON array
  uses_traits       TEXT,       -- JSON array
  sym_references    TEXT,       -- JSON array
  referenced_by     TEXT,       -- JSON array
  layer             TEXT,
  metrics           TEXT,       -- JSON object
  pattern           TEXT,
  violations        TEXT,       -- JSON array
  deprecated        INTEGER,
  since             TEXT,
  stability         TEXT,
  generated         INTEGER,
  source            TEXT,
  last_modified     TEXT,
  signature         TEXT
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

CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file);
CREATE INDEX IF NOT EXISTS idx_symbols_kind ON symbols(kind);
CREATE INDEX IF NOT EXISTS idx_doc_mappings_path ON doc_mappings(doc_path);
