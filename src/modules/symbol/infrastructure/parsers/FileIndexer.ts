import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import globCallback from "glob";
import type { IFileIndexer, FileIndexResult } from "./IFileIndexer.js";
import type { ParserRegistry } from "./ParserRegistry.js";
import type { IFileHashRepository } from "../../domain/repositories/IFileHashRepository.js";

const glob = promisify(globCallback);

/**
 * File Indexer Implementation
 *
 * Uses ParserRegistry (Strategy Pattern) to index files based on their extension.
 * Implements incremental indexing using file hashes.
 */
export class FileIndexer implements IFileIndexer {
  constructor(
    private readonly parserRegistry: ParserRegistry,
    private readonly fileHashRepo: IFileHashRepository,
  ) {}

  async discoverFiles(
    rootPath: string,
    patterns: string[],
    excludePatterns: string[],
  ): Promise<string[]> {
    const ignore = [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/.docs-kit/**",
      ...excludePatterns,
    ];

    const allFiles: string[] = [];

    for (const pattern of patterns) {
      const files = await glob(pattern, {
        cwd: rootPath,
        ignore,
        absolute: true,
        nodir: true,
      });

      // Filter by supported extensions
      const supported = files.filter((file) => this.parserRegistry.isSupported(file));
      allFiles.push(...supported);
    }

    return [...new Set(allFiles)]; // Remove duplicates
  }

  async indexFile(filePath: string, existingHash?: string): Promise<FileIndexResult> {
    try {
      // Read file content
      const content = await readFile(filePath, "utf-8");
      const contentHash = createHash("sha256").update(content).digest("hex");

      // Skip if unchanged (incremental indexing)
      if (existingHash && existingHash === contentHash) {
        return {
          symbols: [],
          relationships: [],
          contentHash,
          skipped: true,
        };
      }

      // Get parser for this file type
      const parser = this.parserRegistry.getParserForFile(filePath);

      if (!parser) {
        return {
          symbols: [],
          relationships: [],
          contentHash,
          skipped: true,
        };
      }

      // Parse the file
      const parseResult = await parser.parse(filePath, content);

      // Update file hash
      this.fileHashRepo.upsert(filePath, contentHash);

      return {
        symbols: parseResult.symbols,
        relationships: parseResult.relationships,
        contentHash,
        skipped: false,
      };
    } catch (error) {
      console.error(`Failed to index ${filePath}:`, error);
      return {
        symbols: [],
        relationships: [],
        skipped: true,
      };
    }
  }

  getSupportedExtensions(): string[] {
    return this.parserRegistry.getSupportedExtensions();
  }
}
