import { describe, it, expect, beforeEach } from "@jest/globals";
import { AggregateRoot } from "../AggregateRoot.js";
import { DomainEvent } from "../DomainEvent.js";

describe("AggregateRoot Base Class", () => {
  interface UserProps {
    name: string;
    email: string;
  }

  class TestDomainEvent extends DomainEvent {
    constructor(public data: { type: string; message: string }) {
      super();
    }

    get eventName(): string {
      return "TestDomainEvent";
    }
  }

  class UserAggregate extends AggregateRoot<UserProps, string> {
    get name(): string {
      return this.props.name;
    }

    get email(): string {
      return this.props.email;
    }

    static create(id: string, props: UserProps): UserAggregate {
      const user = new UserAggregate(props, id);
      user.addDomainEvent(
        new TestDomainEvent({ type: "UserCreated", message: `User ${id} created` }),
      );
      return user;
    }

    updateEmail(newEmail: string): void {
      this.props.email = newEmail;
      this.addDomainEvent(
        new TestDomainEvent({ type: "EmailUpdated", message: `Email updated to ${newEmail}` }),
      );
    }
  }

  describe("inheritance from Entity", () => {
    let aggregate: UserAggregate;

    beforeEach(() => {
      aggregate = new UserAggregate({ name: "John", email: "john@example.com" }, "user-1");
    });

    it("should have id from Entity", () => {
      expect(aggregate.id).toBe("user-1");
    });

    it("should have equals method from Entity", () => {
      const other = new UserAggregate({ name: "Jane", email: "jane@example.com" }, "user-1");

      expect(aggregate.equals(other)).toBe(true);
    });

    it("should support entity equality by id", () => {
      const sameId = new UserAggregate(
        { name: "Different", email: "different@example.com" },
        "user-1",
      );
      const differentId = new UserAggregate({ name: "John", email: "john@example.com" }, "user-2");

      expect(aggregate.equals(sameId)).toBe(true);
      expect(aggregate.equals(differentId)).toBe(false);
    });
  });

  describe("domainEvents getter", () => {
    let aggregate: UserAggregate;

    beforeEach(() => {
      aggregate = new UserAggregate({ name: "John", email: "john@example.com" }, "user-1");
    });

    it("should return empty array initially", () => {
      expect(aggregate.domainEvents).toEqual([]);
      expect(Array.isArray(aggregate.domainEvents)).toBe(true);
    });

    it("should return copy of events not reference", () => {
      const event = new TestDomainEvent({ type: "Test", message: "test" });
      aggregate["addDomainEvent"](event);

      const events1 = aggregate.domainEvents;
      const events2 = aggregate.domainEvents;

      expect(events1).toEqual(events2);
      expect(events1).not.toBe(events2);
    });
  });

  describe("addDomainEvent()", () => {
    let aggregate: UserAggregate;

    beforeEach(() => {
      aggregate = new UserAggregate({ name: "John", email: "john@example.com" }, "user-1");
    });

    it("should add event to domain events", () => {
      const event = new TestDomainEvent({ type: "UserUpdated", message: "User was updated" });

      aggregate["addDomainEvent"](event);

      expect(aggregate.domainEvents).toHaveLength(1);
      expect(aggregate.domainEvents[0]).toBe(event);
    });

    it("should add multiple events in order", () => {
      const event1 = new TestDomainEvent({ type: "Event1", message: "First" });
      const event2 = new TestDomainEvent({ type: "Event2", message: "Second" });
      const event3 = new TestDomainEvent({ type: "Event3", message: "Third" });

      aggregate["addDomainEvent"](event1);
      aggregate["addDomainEvent"](event2);
      aggregate["addDomainEvent"](event3);

      expect(aggregate.domainEvents).toHaveLength(3);
      expect(aggregate.domainEvents[0]).toBe(event1);
      expect(aggregate.domainEvents[1]).toBe(event2);
      expect(aggregate.domainEvents[2]).toBe(event3);
    });

    it("should preserve event order", () => {
      const events: TestDomainEvent[] = [];

      for (let i = 0; i < 5; i++) {
        const event = new TestDomainEvent({ type: `Event${i}`, message: `Message ${i}` });
        events.push(event);
        aggregate["addDomainEvent"](event);
      }

      const domainEvents = aggregate.domainEvents;

      expect(domainEvents).toHaveLength(5);
      domainEvents.forEach((event, index) => {
        expect(event).toBe(events[index]);
      });
    });
  });

  describe("clearDomainEvents()", () => {
    let aggregate: UserAggregate;

    beforeEach(() => {
      aggregate = new UserAggregate({ name: "John", email: "john@example.com" }, "user-1");
    });

    it("should return empty array when no events", () => {
      const cleared = aggregate.clearDomainEvents();

      expect(cleared).toEqual([]);
    });

    it("should return all events and clear them", () => {
      const event1 = new TestDomainEvent({ type: "Event1", message: "First" });
      const event2 = new TestDomainEvent({ type: "Event2", message: "Second" });

      aggregate["addDomainEvent"](event1);
      aggregate["addDomainEvent"](event2);

      const cleared = aggregate.clearDomainEvents();

      expect(cleared).toHaveLength(2);
      expect(cleared[0]).toBe(event1);
      expect(cleared[1]).toBe(event2);
      expect(aggregate.domainEvents).toEqual([]);
    });

    it("should return copy of events", () => {
      const event = new TestDomainEvent({ type: "Test", message: "test" });
      aggregate["addDomainEvent"](event);

      const cleared = aggregate.clearDomainEvents();

      expect(cleared).toHaveLength(1);
      expect(cleared[0]).toBe(event);

      // Modifying returned array should not affect aggregate
      cleared.push(new TestDomainEvent({ type: "New", message: "new" }));

      expect(aggregate.domainEvents).toEqual([]);
    });

    it("should clear events for subsequent operations", () => {
      const event1 = new TestDomainEvent({ type: "Event1", message: "First" });
      aggregate["addDomainEvent"](event1);

      const firstClear = aggregate.clearDomainEvents();
      expect(firstClear).toHaveLength(1);

      const secondClear = aggregate.clearDomainEvents();
      expect(secondClear).toEqual([]);
    });

    it("should allow adding events again after clear", () => {
      const event1 = new TestDomainEvent({ type: "Event1", message: "First" });
      const event2 = new TestDomainEvent({ type: "Event2", message: "Second" });

      aggregate["addDomainEvent"](event1);
      aggregate.clearDomainEvents();

      aggregate["addDomainEvent"](event2);

      expect(aggregate.domainEvents).toHaveLength(1);
      expect(aggregate.domainEvents[0]).toBe(event2);
    });
  });

  describe("Aggregate lifecycle pattern", () => {
    it("should support create pattern with initial event", () => {
      const user = UserAggregate.create("user-1", { name: "John", email: "john@example.com" });

      expect(user.id).toBe("user-1");
      expect(user.name).toBe("John");
      expect(user.domainEvents).toHaveLength(1);
      expect(user.domainEvents[0].eventName).toBe("TestDomainEvent");
    });

    it("should accumulate events through operations", () => {
      const user = UserAggregate.create("user-1", { name: "John", email: "john@example.com" });

      expect(user.domainEvents).toHaveLength(1);

      user.updateEmail("newemail@example.com");

      expect(user.domainEvents).toHaveLength(2);
      expect(user.email).toBe("newemail@example.com");
    });

    it("should allow event sourcing pattern", () => {
      const user = UserAggregate.create("user-1", { name: "John", email: "john@example.com" });
      user.updateEmail("new1@example.com");
      user.updateEmail("new2@example.com");

      const events = user.clearDomainEvents();

      expect(events).toHaveLength(3);
      expect(events[0].eventName).toBe("TestDomainEvent");
      expect(events[1].eventName).toBe("TestDomainEvent");
      expect(events[2].eventName).toBe("TestDomainEvent");

      expect(user.domainEvents).toHaveLength(0);
    });
  });

  describe("Multiple aggregates", () => {
    it("should maintain separate event lists", () => {
      const user1 = UserAggregate.create("user-1", { name: "John", email: "john@example.com" });
      const user2 = UserAggregate.create("user-2", { name: "Jane", email: "jane@example.com" });

      user1.updateEmail("john2@example.com");

      expect(user1.domainEvents).toHaveLength(2);
      expect(user2.domainEvents).toHaveLength(1);
    });

    it("should isolate clearing events between aggregates", () => {
      const user1 = UserAggregate.create("user-1", { name: "John", email: "john@example.com" });
      const user2 = UserAggregate.create("user-2", { name: "Jane", email: "jane@example.com" });

      user1.clearDomainEvents();

      expect(user1.domainEvents).toHaveLength(0);
      expect(user2.domainEvents).toHaveLength(1);
    });
  });
});
