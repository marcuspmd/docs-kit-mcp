import { describe, it, expect } from "@jest/globals";
import { DomainEvent } from "../DomainEvent.js";

describe("DomainEvent Base Class", () => {
  // Create a concrete implementation for testing
  class TestDomainEvent extends DomainEvent {
    get eventName(): string {
      return "TestDomainEvent";
    }
  }

  describe("constructor", () => {
    let event: TestDomainEvent;

    beforeEach(() => {
      event = new TestDomainEvent();
    });

    it("should create domain event with eventId", () => {
      expect(event.eventId).toBeDefined();
      expect(typeof event.eventId).toBe("string");
      expect(event.eventId.length).toBeGreaterThan(0);
    });

    it("should generate valid UUID for eventId", () => {
      expect(event.eventId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it("should create domain event with occurredOn timestamp", () => {
      expect(event.occurredOn).toBeDefined();
      expect(event.occurredOn instanceof Date).toBe(true);
    });

    it("should set occurredOn to current time", () => {
      const before = new Date();
      const newEvent = new TestDomainEvent();
      const after = new Date();

      expect(newEvent.occurredOn.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(newEvent.occurredOn.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it("should generate unique eventIds for multiple events", () => {
      const event1 = new TestDomainEvent();
      const event2 = new TestDomainEvent();

      expect(event1.eventId).not.toBe(event2.eventId);
    });
  });

  describe("abstract eventName", () => {
    it("should require implementation of eventName", () => {
      const event = new TestDomainEvent();

      expect(event.eventName).toBe("TestDomainEvent");
    });

    it("should allow different event names", () => {
      class UserCreatedEvent extends DomainEvent {
        get eventName(): string {
          return "UserCreatedEvent";
        }
      }

      class UserDeletedEvent extends DomainEvent {
        get eventName(): string {
          return "UserDeletedEvent";
        }
      }

      const created = new UserCreatedEvent();
      const deleted = new UserDeletedEvent();

      expect(created.eventName).toBe("UserCreatedEvent");
      expect(deleted.eventName).toBe("UserDeletedEvent");
      expect(created.eventName).not.toBe(deleted.eventName);
    });
  });

  describe("Event semantics", () => {
    it("should support domain events with additional properties", () => {
      class UserCreatedEvent extends DomainEvent {
        constructor(
          public userId: string,
          public email: string,
        ) {
          super();
        }

        get eventName(): string {
          return "UserCreatedEvent";
        }
      }

      const event = new UserCreatedEvent("user-123", "user@example.com");

      expect(event.eventId).toBeDefined();
      expect(event.occurredOn).toBeDefined();
      expect(event.userId).toBe("user-123");
      expect(event.email).toBe("user@example.com");
      expect(event.eventName).toBe("UserCreatedEvent");
    });

    it("should maintain separate event state for different instances", () => {
      class OrderEvent extends DomainEvent {
        constructor(public orderId: string) {
          super();
        }

        get eventName(): string {
          return "OrderEvent";
        }
      }

      const event1 = new OrderEvent("order-1");
      const event2 = new OrderEvent("order-2");

      expect(event1.orderId).not.toBe(event2.orderId);
      expect(event1.eventId).not.toBe(event2.eventId);
    });
  });

  describe("Timestamp behavior", () => {
    it("should preserve timestamp across property accesses", () => {
      const event = new TestDomainEvent();
      const firstAccess = event.occurredOn.getTime();

      // Small delay
      const secondAccess = event.occurredOn.getTime();

      expect(firstAccess).toBe(secondAccess);
    });

    it("should have different timestamps for sequential events", async () => {
      const event1 = new TestDomainEvent();

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 1));

      const event2 = new TestDomainEvent();

      expect(event1.occurredOn.getTime()).toBeLessThanOrEqual(event2.occurredOn.getTime());
    });
  });
});
