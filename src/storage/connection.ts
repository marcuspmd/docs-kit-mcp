import Database from "better-sqlite3";

export interface DbOptions {
  path?: string;
  inMemory?: boolean;
}

export function createDatabase(options?: DbOptions): Database.Database {
  const db = new Database(
    options?.inMemory ? ":memory:" : (options?.path ?? "src/storage/index.db"),
  );
  configureDatabase(db);
  return db;
}

export function configureDatabase(db: Database.Database): void {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.pragma("synchronous = NORMAL");
}
