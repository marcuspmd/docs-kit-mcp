import { Entity } from "./Entity.js";
import { DomainEvent } from "./DomainEvent.js";

/**
 * Base class for Aggregate Roots
 *
 * An Aggregate Root is an Entity that is the entry point for accessing
 * a cluster of related objects. It maintains consistency boundaries
 * and collects domain events.
 */
export abstract class AggregateRoot<TProps, TId = string> extends Entity<TProps, TId> {
  private _domainEvents: DomainEvent[] = [];

  get domainEvents(): readonly DomainEvent[] {
    return [...this._domainEvents];
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  public clearDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }
}
