import type Database from "better-sqlite3";
import type { IFileHashRepository } from "../../../domain/repositories/IFileHashRepository.js";

/**
 * SQLite File Hash Repository Implementation
 */
export class SqliteFileHashRepository implements IFileHashRepository {
  private readonly getStmt: Database.Statement;
  private readonly upsertStmt: Database.Statement;
  private readonly getAllStmt: Database.Statement;
  private readonly deleteStmt: Database.Statement;
  private readonly clearStmt: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.getStmt = db.prepare(
      "SELECT content_hash, last_indexed_at FROM file_hashes WHERE file_path = ?",
    );
    this.upsertStmt = db.prepare(
      "INSERT OR REPLACE INTO file_hashes (file_path, content_hash, last_indexed_at) VALUES (?, ?, datetime('now'))",
    );
    this.getAllStmt = db.prepare("SELECT file_path, content_hash FROM file_hashes");
    this.deleteStmt = db.prepare("DELETE FROM file_hashes WHERE file_path = ?");
    this.clearStmt = db.prepare("DELETE FROM file_hashes");
  }

  get(filePath: string): { contentHash: string; lastIndexedAt: string } | undefined {
    const row = this.getStmt.get(filePath) as
      | { content_hash: string; last_indexed_at: string }
      | undefined;
    return row ? { contentHash: row.content_hash, lastIndexedAt: row.last_indexed_at } : undefined;
  }

  upsert(filePath: string, contentHash: string): void {
    this.upsertStmt.run(filePath, contentHash);
  }

  getAll(): Array<{ filePath: string; contentHash: string }> {
    const rows = this.getAllStmt.all() as Array<{ file_path: string; content_hash: string }>;
    return rows.map((r) => ({ filePath: r.file_path, contentHash: r.content_hash }));
  }

  delete(filePath: string): void {
    this.deleteStmt.run(filePath);
  }

  clear(): void {
    this.clearStmt.run();
  }
}
