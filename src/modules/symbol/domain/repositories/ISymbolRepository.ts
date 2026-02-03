import type { CodeSymbol } from "../entities/CodeSymbol.js";
import type { SymbolKindType } from "../value-objects/SymbolKind.js";

/**
 * Symbol Repository Interface
 *
 * Defines the contract for symbol persistence operations.
 */
export interface ISymbolRepository {
  /**
   * Save or update a symbol
   */
  upsert(symbol: CodeSymbol): void;

  /**
   * Save multiple symbols in batch
   */
  upsertMany(symbols: CodeSymbol[]): void;

  /**
   * Find symbol by ID
   */
  findById(id: string): CodeSymbol | undefined;

  /**
   * Find symbols by IDs
   */
  findByIds(ids: string[]): CodeSymbol[];

  /**
   * Find symbols by name (matches name or qualifiedName)
   */
  findByName(name: string): CodeSymbol[];

  /**
   * Find all symbols
   */
  findAll(): CodeSymbol[];

  /**
   * Find symbols in a specific file
   */
  findByFile(file: string): CodeSymbol[];

  /**
   * Find symbols of a specific kind
   */
  findByKind(kind: SymbolKindType): CodeSymbol[];

  /**
   * Delete all symbols in a file
   */
  deleteByFile(file: string): void;

  /**
   * Delete all symbols
   */
  clear(): void;

  /**
   * Count total symbols
   */
  count(): number;
}
