import { Entity } from "../../../../@core/domain/Entity.js";

export type ChangeType =
  | "added"
  | "removed"
  | "modified"
  | "renamed"
  | "moved"
  | "signature_changed"
  | "visibility_changed"
  | "behavior_changed";

export interface ChangeImpactProps {
  symbolId: string;
  symbolName: string;
  changeType: ChangeType;
  diff: string;
  breakingChange?: boolean;
  severity?: "low" | "medium" | "high" | "critical";
  docUpdateRequired: boolean;
  directImpacts?: string[];
  indirectImpacts?: string[];
  reason?: string;
}

/**
 * ChangeImpact Entity
 *
 * Represents the impact of a code change.
 */
export class ChangeImpact extends Entity<ChangeImpactProps, string> {
  private constructor(props: ChangeImpactProps, id: string) {
    super(props, id);
  }

  get symbolId(): string {
    return this.props.symbolId;
  }
  get symbolName(): string {
    return this.props.symbolName;
  }
  get changeType(): ChangeType {
    return this.props.changeType;
  }
  get diff(): string {
    return this.props.diff;
  }
  get breakingChange(): boolean {
    return this.props.breakingChange ?? false;
  }
  get severity(): string {
    return this.props.severity ?? "low";
  }
  get docUpdateRequired(): boolean {
    return this.props.docUpdateRequired;
  }
  get directImpacts(): string[] {
    return this.props.directImpacts ?? [];
  }
  get indirectImpacts(): string[] {
    return this.props.indirectImpacts ?? [];
  }
  get reason(): string | undefined {
    return this.props.reason;
  }

  public static create(props: ChangeImpactProps): ChangeImpact {
    const id = `${props.symbolId}::${props.changeType}`;
    return new ChangeImpact(props, id);
  }
}
