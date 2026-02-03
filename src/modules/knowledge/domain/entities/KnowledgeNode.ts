import { Entity } from "../../../../@core/domain/Entity.js";

export interface KnowledgeNodeProps {
  type: "symbol" | "document" | "concept";
  label: string;
  content?: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
}

/**
 * KnowledgeNode Entity
 *
 * Represents a node in the knowledge graph.
 */
export class KnowledgeNode extends Entity<KnowledgeNodeProps, string> {
  private constructor(props: KnowledgeNodeProps, id: string) {
    super(props, id);
  }

  get type(): "symbol" | "document" | "concept" {
    return this.props.type;
  }

  get label(): string {
    return this.props.label;
  }

  get content(): string | undefined {
    return this.props.content;
  }

  get embedding(): number[] | undefined {
    return this.props.embedding;
  }

  get metadata(): Record<string, unknown> | undefined {
    return this.props.metadata;
  }

  public static create(id: string, props: KnowledgeNodeProps): KnowledgeNode {
    return new KnowledgeNode(props, id);
  }
}
