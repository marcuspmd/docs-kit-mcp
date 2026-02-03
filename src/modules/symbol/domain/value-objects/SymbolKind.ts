import { ValueObject } from "../../../../@core/domain/ValueObject.js";
import { z } from "zod";

export const SymbolKindSchema = z.enum([
  "class",
  "abstract_class",
  "interface",
  "enum",
  "type",
  "trait",
  "method",
  "function",
  "constructor",
  "lambda",
  "dto",
  "entity",
  "value_object",
  "event",
  "listener",
  "service",
  "repository",
  "use_case",
  "controller",
  "command",
  "query",
  "handler",
  "factory",
  "builder",
  "model",
  "schema",
  "migration",
  "middleware",
  "provider",
  "component",
  "test",
  "mock",
]);

export type SymbolKindType = z.infer<typeof SymbolKindSchema>;

interface SymbolKindProps {
  value: SymbolKindType;
}

/**
 * SymbolKind Value Object
 *
 * Represents the type/kind of a code symbol (class, function, method, etc.)
 */
export class SymbolKind extends ValueObject<SymbolKindProps> {
  private constructor(props: SymbolKindProps) {
    super(props);
  }

  get value(): SymbolKindType {
    return this.props.value;
  }

  public static create(kind: SymbolKindType): SymbolKind {
    return new SymbolKind({ value: kind });
  }

  public static fromString(kind: string): SymbolKind {
    const parsed = SymbolKindSchema.safeParse(kind);
    if (!parsed.success) {
      throw new Error(`Invalid symbol kind: ${kind}`);
    }
    return new SymbolKind({ value: parsed.data });
  }

  public isClass(): boolean {
    return this.props.value === "class" || this.props.value === "abstract_class";
  }

  public isFunction(): boolean {
    return (
      this.props.value === "function" ||
      this.props.value === "method" ||
      this.props.value === "lambda"
    );
  }

  public isType(): boolean {
    return (
      this.props.value === "type" || this.props.value === "interface" || this.props.value === "enum"
    );
  }

  public toString(): string {
    return this.props.value;
  }
}
