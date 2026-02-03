import type { UseCase } from "../../../../@core/application/UseCase.js";
import { Result } from "../../../../@core/domain/Result.js";
import type { ISymbolRepository } from "../../domain/repositories/ISymbolRepository.js";
import type { IRelationshipRepository } from "../../domain/repositories/IRelationshipRepository.js";
import type { IFileHashRepository } from "../../domain/repositories/IFileHashRepository.js";
import type { IndexProjectInput, IndexProjectOutput } from "../dtos/symbol.dto.js";
import type { IFileIndexer } from "../../infrastructure/parsers/IFileIndexer.js";

/**
 * IndexProject Use Case
 *
 * Indexes a project's source files, extracting symbols and their relationships.
 */
export class IndexProjectUseCase implements UseCase<IndexProjectInput, IndexProjectOutput> {
  constructor(
    private readonly symbolRepo: ISymbolRepository,
    private readonly relationshipRepo: IRelationshipRepository,
    private readonly fileHashRepo: IFileHashRepository,
    private readonly fileIndexer: IFileIndexer,
  ) {}

  async execute(input: IndexProjectInput): Promise<Result<IndexProjectOutput>> {
    const startTime = performance.now();
    const errors: string[] = [];
    let filesProcessed = 0;
    let symbolsFound = 0;
    let relationshipsFound = 0;

    try {
      // Clear existing data if full rebuild requested
      if (input.fullRebuild) {
        this.symbolRepo.clear();
        this.relationshipRepo.clear();
        this.fileHashRepo.clear();
      }

      // Get files to index
      const files = await this.fileIndexer.discoverFiles(
        input.rootPath,
        input.patterns ?? ["**/*.ts", "**/*.js", "**/*.py", "**/*.go"],
        input.excludePatterns ?? ["**/node_modules/**", "**/dist/**", "**/__tests__/**"],
      );

      // Get existing file hashes for incremental indexing
      const existingHashes = new Map(
        this.fileHashRepo.getAll().map((h) => [h.filePath, h.contentHash]),
      );

      // Index files
      for (const filePath of files) {
        try {
          const indexResult = await this.fileIndexer.indexFile(
            filePath,
            existingHashes.get(filePath),
          );

          if (indexResult.skipped) {
            continue; // File unchanged
          }

          // Delete old symbols for this file
          this.symbolRepo.deleteByFile(filePath);

          // Save new symbols
          if (indexResult.symbols.length > 0) {
            this.symbolRepo.upsertMany(indexResult.symbols);
            symbolsFound += indexResult.symbols.length;
          }

          // Save relationships
          if (indexResult.relationships.length > 0) {
            this.relationshipRepo.upsertMany(indexResult.relationships);
            relationshipsFound += indexResult.relationships.length;
          }

          // Update file hash
          if (indexResult.contentHash) {
            this.fileHashRepo.upsert(filePath, indexResult.contentHash);
          }

          filesProcessed++;
        } catch (error) {
          errors.push(
            `Error indexing ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      const duration = performance.now() - startTime;

      return Result.ok({
        filesProcessed,
        symbolsFound,
        relationshipsFound,
        duration,
        errors,
      });
    } catch (error) {
      return Result.fail(error as Error);
    }
  }
}
