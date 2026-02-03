import type { IRelationshipRepository } from "../../../domain/repositories/IRelationshipRepository.js";
import type { SymbolRelationship } from "../../../domain/entities/SymbolRelationship.js";

/**
 * In-Memory Relationship Repository Implementation
 *
 * Useful for testing and development.
 */
export class InMemoryRelationshipRepository implements IRelationshipRepository {
  private relationships: Map<string, SymbolRelationship> = new Map();

  private getKey(rel: SymbolRelationship): string {
    return `${rel.sourceId}::${rel.targetId}::${rel.type}`;
  }

  upsert(relationship: SymbolRelationship): void {
    this.relationships.set(this.getKey(relationship), relationship);
  }

  upsertMany(relationships: SymbolRelationship[]): void {
    for (const rel of relationships) {
      this.upsert(rel);
    }
  }

  findBySource(sourceId: string): SymbolRelationship[] {
    return Array.from(this.relationships.values()).filter((r) => r.sourceId === sourceId);
  }

  findByTarget(targetId: string): SymbolRelationship[] {
    return Array.from(this.relationships.values()).filter((r) => r.targetId === targetId);
  }

  findAll(): SymbolRelationship[] {
    return Array.from(this.relationships.values());
  }

  deleteBySource(sourceId: string): void {
    for (const [key, rel] of this.relationships) {
      if (rel.sourceId === sourceId) {
        this.relationships.delete(key);
      }
    }
  }

  clear(): void {
    this.relationships.clear();
  }

  count(): number {
    return this.relationships.size;
  }
}
