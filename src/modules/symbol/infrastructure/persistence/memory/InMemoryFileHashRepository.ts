import type { IFileHashRepository } from "../../../domain/repositories/IFileHashRepository.js";

/**
 * In-Memory File Hash Repository Implementation
 *
 * Useful for testing and development.
 */
export class InMemoryFileHashRepository implements IFileHashRepository {
  private hashes: Map<string, { contentHash: string; lastIndexedAt: string }> = new Map();

  get(filePath: string): { contentHash: string; lastIndexedAt: string } | undefined {
    return this.hashes.get(filePath);
  }

  upsert(filePath: string, contentHash: string): void {
    this.hashes.set(filePath, {
      contentHash,
      lastIndexedAt: new Date().toISOString(),
    });
  }

  getAll(): Array<{ filePath: string; contentHash: string }> {
    return Array.from(this.hashes.entries()).map(([filePath, data]) => ({
      filePath,
      contentHash: data.contentHash,
    }));
  }

  delete(filePath: string): void {
    this.hashes.delete(filePath);
  }

  clear(): void {
    this.hashes.clear();
  }
}
