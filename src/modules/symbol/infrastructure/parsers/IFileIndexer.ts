import type { CodeSymbol } from "../../domain/entities/CodeSymbol.js";
import type { SymbolRelationship } from "../../domain/entities/SymbolRelationship.js";

/**
 * File Indexer Result
 */
export interface FileIndexResult {
  symbols: CodeSymbol[];
  relationships: SymbolRelationship[];
  contentHash?: string;
  skipped: boolean;
}

/**
 * File Indexer Interface
 *
 * Abstracts the file indexing/parsing logic.
 */
export interface IFileIndexer {
  /**
   * Discover files to index based on patterns
   */
  discoverFiles(rootPath: string, patterns: string[], excludePatterns: string[]): Promise<string[]>;

  /**
   * Index a single file
   * @param filePath - Path to the file
   * @param existingHash - Existing content hash for incremental indexing
   * @returns Index result with symbols and relationships
   */
  indexFile(filePath: string, existingHash?: string): Promise<FileIndexResult>;

  /**
   * Get supported file extensions
   */
  getSupportedExtensions(): string[];
}
