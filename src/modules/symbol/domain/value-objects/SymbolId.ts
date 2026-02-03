import { ValueObject } from "../../../../@core/domain/ValueObject.js";
import { createHash } from "node:crypto";

interface SymbolIdProps {
  value: string;
}

/**
 * SymbolId Value Object
 *
 * Represents a unique identifier for a code symbol.
 * Generated deterministically from file path, name, and kind.
 */
export class SymbolId extends ValueObject<SymbolIdProps> {
  private constructor(props: SymbolIdProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  public static create(file: string, name: string, kind: string): SymbolId {
    const hash = createHash("sha256")
      .update(`${file}::${name}::${kind}`)
      .digest("hex")
      .slice(0, 16);
    return new SymbolId({ value: hash });
  }

  public static fromValue(value: string): SymbolId {
    return new SymbolId({ value });
  }

  public toString(): string {
    return this.props.value;
  }
}
