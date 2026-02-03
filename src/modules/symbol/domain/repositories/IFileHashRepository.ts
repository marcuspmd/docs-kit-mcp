/**
 * File Hash Repository Interface
 *
 * Tracks file content hashes to enable incremental indexing.
 */
export interface IFileHashRepository {
  /**
   * Get hash info for a file
   */
  get(filePath: string): { contentHash: string; lastIndexedAt: string } | undefined;

  /**
   * Save or update file hash
   */
  upsert(filePath: string, contentHash: string): void;

  /**
   * Get all file hashes
   */
  getAll(): Array<{ filePath: string; contentHash: string }>;

  /**
   * Delete hash for a file
   */
  delete(filePath: string): void;

  /**
   * Clear all hashes
   */
  clear(): void;
}
