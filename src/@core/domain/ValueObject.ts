/**
 * Base class for all Value Objects
 *
 * A Value Object is identified by its attributes rather than identity.
 * Two VOs with the same properties are considered equal.
 * VOs are immutable by design.
 */
export abstract class ValueObject<TProps extends object> {
  protected readonly props: Readonly<TProps>;

  constructor(props: TProps) {
    this.props = Object.freeze({ ...props });
  }

  public equals(vo?: ValueObject<TProps>): boolean {
    if (vo === null || vo === undefined) {
      return false;
    }

    if (vo.props === undefined) {
      return false;
    }

    return this.propsEqual(vo.props);
  }

  protected propsEqual(props: TProps): boolean {
    return JSON.stringify(this.props) === JSON.stringify(props);
  }

  public toValue(): TProps {
    return { ...this.props } as TProps;
  }
}
