import type { SymbolRelationship } from "../entities/SymbolRelationship.js";

/**
 * Relationship Repository Interface
 *
 * Defines the contract for symbol relationship persistence.
 */
export interface IRelationshipRepository {
  /**
   * Save or update a relationship
   */
  upsert(relationship: SymbolRelationship): void;

  /**
   * Save multiple relationships in batch
   */
  upsertMany(relationships: SymbolRelationship[]): void;

  /**
   * Find relationships where symbol is the source
   */
  findBySource(sourceId: string): SymbolRelationship[];

  /**
   * Find relationships where symbol is the target
   */
  findByTarget(targetId: string): SymbolRelationship[];

  /**
   * Find all relationships
   */
  findAll(): SymbolRelationship[];

  /**
   * Delete all relationships for a source symbol
   */
  deleteBySource(sourceId: string): void;

  /**
   * Delete all relationships
   */
  clear(): void;

  /**
   * Count total relationships
   */
  count(): number;
}
