import type Database from "better-sqlite3";

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
      return rows.map((row) => ({ filePath: row.file_path, contentHash: row.content_hash }));
    },
    delete(filePath) {
      deleteStmt.run(filePath);
    },
    clear() {
      clearStmt.run();
    },
  };
}
