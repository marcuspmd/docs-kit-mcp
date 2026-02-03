/**
 * Base class for Domain Events
 *
 * Domain Events represent something meaningful that happened in the domain.
 * They are immutable and carry all data needed to describe the event.
 */
export abstract class DomainEvent {
  public readonly occurredOn: Date;
  public readonly eventId: string;

  constructor() {
    this.occurredOn = new Date();
    this.eventId = crypto.randomUUID();
  }

  abstract get eventName(): string;
}
