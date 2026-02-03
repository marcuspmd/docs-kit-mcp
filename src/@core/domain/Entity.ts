/**
 * Base class for all Domain Entities
 *
 * An Entity is identified by its unique identity rather than its attributes.
 * Two entities with the same ID are considered equal, regardless of other properties.
 */
export abstract class Entity<TProps, TId = string> {
  protected readonly _id: TId;
  protected props: TProps;

  constructor(props: TProps, id: TId) {
    this._id = id;
    this.props = props;
  }

  get id(): TId {
    return this._id;
  }

  public equals(entity?: Entity<TProps, TId>): boolean {
    if (entity === null || entity === undefined) {
      return false;
    }

    if (this === entity) {
      return true;
    }

    if (!(entity instanceof Entity)) {
      return false;
    }

    return this._id === entity._id;
  }
}
