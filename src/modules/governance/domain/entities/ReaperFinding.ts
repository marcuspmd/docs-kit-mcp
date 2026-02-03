import { Entity } from "../../../../@core/domain/Entity.js";

export interface ReaperFindingProps {
  type: "unused_export" | "dead_code" | "unreachable" | "orphan_file";
  target: string;
  reason: string;
  suggestedAction: string;
}

/**
 * ReaperFinding Entity
 *
 * Represents a dead code finding.
 */
export class ReaperFinding extends Entity<ReaperFindingProps, string> {
  private constructor(props: ReaperFindingProps, id: string) {
    super(props, id);
  }

  get type(): ReaperFindingProps["type"] {
    return this.props.type;
  }

  get target(): string {
    return this.props.target;
  }

  get reason(): string {
    return this.props.reason;
  }

  get suggestedAction(): string {
    return this.props.suggestedAction;
  }

  public static create(props: ReaperFindingProps): ReaperFinding {
    const id = `${props.type}::${props.target}`;
    return new ReaperFinding(props, id);
  }
}
