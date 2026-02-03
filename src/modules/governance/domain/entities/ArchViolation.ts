import { Entity } from "../../../../@core/domain/Entity.js";

export interface ArchViolationProps {
  rule: string;
  file: string;
  symbolId?: string;
  message: string;
  severity: "info" | "warning" | "error" | "critical";
}

/**
 * ArchViolation Entity
 *
 * Represents an architecture violation.
 */
export class ArchViolation extends Entity<ArchViolationProps, string> {
  private constructor(props: ArchViolationProps, id: string) {
    super(props, id);
  }

  get rule(): string {
    return this.props.rule;
  }

  get file(): string {
    return this.props.file;
  }

  get symbolId(): string | undefined {
    return this.props.symbolId;
  }

  get message(): string {
    return this.props.message;
  }

  get severity(): "info" | "warning" | "error" | "critical" {
    return this.props.severity;
  }

  public static create(props: ArchViolationProps): ArchViolation {
    const id = `${props.rule}::${props.file}::${props.symbolId ?? "global"}`;
    return new ArchViolation(props, id);
  }
}
