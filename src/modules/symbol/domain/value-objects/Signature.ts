import { ValueObject } from "../../../../@core/domain/ValueObject.js";

interface SignatureProps {
  raw: string;
  parameters?: string[];
  returnType?: string;
  typeParameters?: string[];
  modifiers?: string[];
}

/**
 * Signature Value Object
 *
 * Represents the signature of a function, method, or class.
 */
export class Signature extends ValueObject<SignatureProps> {
  private constructor(props: SignatureProps) {
    super(props);
  }

  get raw(): string {
    return this.props.raw;
  }

  get parameters(): string[] {
    return this.props.parameters ?? [];
  }

  get returnType(): string | undefined {
    return this.props.returnType;
  }

  get typeParameters(): string[] {
    return this.props.typeParameters ?? [];
  }

  get modifiers(): string[] {
    return this.props.modifiers ?? [];
  }

  public static create(props: SignatureProps): Signature {
    return new Signature(props);
  }

  public static fromRaw(raw: string): Signature {
    return new Signature({ raw });
  }

  public hasModifier(modifier: string): boolean {
    return this.modifiers.includes(modifier);
  }

  public isAsync(): boolean {
    return this.hasModifier("async");
  }

  public isStatic(): boolean {
    return this.hasModifier("static");
  }

  public isAbstract(): boolean {
    return this.hasModifier("abstract");
  }

  public toString(): string {
    return this.props.raw;
  }
}
