# Task 11 — SQLite Storage Layer

> **Status:** pending
> **Layer:** Storage
> **Priority:** MVP
> **Depends on:** 01
> **Unblocks:** 02, 07, 15

## Pain Point
The indexer, doc registry, and knowledge graph all need persistent storage. Without a shared database layer, each module would reinvent file-based storage, leading to inconsistency and data loss. SQLite provides zero-config, single-file persistence perfect for a dev tool.

## Objective
Implement a SQLite database layer with schema management, typed query helpers, and connection lifecycle for all modules to share.

## Technical Hints

```ts
// src/storage/db.ts

import Database from "better-sqlite3";

export interface DbOptions {
  path?: string;          // default: "src/storage/index.db"
  inMemory?: boolean;     // for tests
}

export function createDatabase(options?: DbOptions): Database.Database;

export function initializeSchema(db: Database.Database): void;
```

Schema from `start.md §4.3` plus tables for doc registry and indexer:

```sql
-- src/storage/schema.sql

CREATE TABLE IF NOT EXISTS symbols (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL,
  file        TEXT NOT NULL,
  start_line  INTEGER NOT NULL,
  end_line    INTEGER NOT NULL,
  parent      TEXT,
  doc_ref     TEXT,
  last_modified TEXT,
  pattern     TEXT,
  violations  TEXT  -- JSON array
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
```

Typed repository helpers:

```ts
export interface SymbolRepository {
  upsert(symbol: CodeSymbol): void;
  findById(id: string): CodeSymbol | undefined;
  findByFile(file: string): CodeSymbol[];
  findByKind(kind: SymbolKind): CodeSymbol[];
  deleteByFile(file: string): void;
}

export function createSymbolRepository(db: Database.Database): SymbolRepository;
```

## Files Involved
- `src/storage/db.ts` — database creation and schema initialization
- `src/storage/schema.sql` — DDL statements
- `tests/storage.test.ts` — unit tests

## Acceptance Criteria
- [ ] `createDatabase()` creates or opens a SQLite file
- [ ] `initializeSchema()` creates all tables idempotently (`IF NOT EXISTS`)
- [ ] `SymbolRepository` CRUD operations work correctly
- [ ] In-memory mode works for tests
- [ ] Schema migrations are forward-compatible (won't crash on existing DBs)
- [ ] Unit tests for all repository methods

## Scenarios / Examples

```ts
const db = createDatabase({ inMemory: true });
initializeSchema(db);

const repo = createSymbolRepository(db);
repo.upsert({
  id: "src/user.ts:User:class",
  name: "User",
  kind: "class",
  file: "src/user.ts",
  startLine: 1,
  endLine: 20,
});

const found = repo.findByFile("src/user.ts");
// [{ id: "src/user.ts:User:class", name: "User", kind: "class", ... }]
```
