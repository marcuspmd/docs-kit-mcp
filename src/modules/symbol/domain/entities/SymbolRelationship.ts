import { Entity } from "../../../../@core/domain/Entity.js";
import { z } from "zod";

export const RelationshipTypeSchema = z.union([
  z.enum([
    "calls",
    "inherits",
    "implements",
    "instantiates",
    "uses",
    "contains",
    "imports",
    "exports",
  ]),
  z.string().min(1),
]);

export type RelationshipType = z.infer<typeof RelationshipTypeSchema>;

export interface SymbolRelationshipProps {
  sourceId: string;
  targetId: string;
  type: RelationshipType;
  confidence?: number;
  location?: {
    file: string;
    line: number;
  };
  inferred?: boolean;
}

/**
 * SymbolRelationship Entity
 *
 * Represents a relationship between two symbols (imports, extends, calls, etc.)
 */
export class SymbolRelationship extends Entity<SymbolRelationshipProps, string> {
  private constructor(props: SymbolRelationshipProps, id: string) {
    super(props, id);
  }

  get sourceId(): string {
    return this.props.sourceId;
  }

  get targetId(): string {
    return this.props.targetId;
  }

  get type(): RelationshipType {
    return this.props.type;
  }

  get confidence(): number {
    return this.props.confidence ?? 1.0;
  }

  get location(): { file: string; line: number } | undefined {
    return this.props.location;
  }

  get inferred(): boolean {
    return this.props.inferred ?? false;
  }

  public static create(props: SymbolRelationshipProps): SymbolRelationship {
    const id = `${props.sourceId}::${props.targetId}::${props.type}`;
    return new SymbolRelationship(props, id);
  }

  public static fromPersistence(props: SymbolRelationshipProps): SymbolRelationship {
    const id = `${props.sourceId}::${props.targetId}::${props.type}`;
    return new SymbolRelationship(props, id);
  }

  public toPersistence(): Record<string, unknown> {
    return {
      sourceId: this.props.sourceId,
      targetId: this.props.targetId,
      type: this.props.type,
      confidence: this.props.confidence,
      location: this.props.location,
      inferred: this.props.inferred,
    };
  }
}
