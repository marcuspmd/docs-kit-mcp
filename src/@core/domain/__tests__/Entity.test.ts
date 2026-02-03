import { describe, it, expect, beforeEach } from "@jest/globals";
import { Entity } from "../Entity.js";

describe("Entity Base Class", () => {
  interface UserProps {
    name: string;
    email: string;
  }

  class User extends Entity<UserProps, string> {
    get name(): string {
      return this.props.name;
    }

    get email(): string {
      return this.props.email;
    }
  }

  describe("constructor", () => {
    it("should create entity with props and id", () => {
      const props: UserProps = { name: "John", email: "john@example.com" };
      const user = new User(props, "user-1");

      expect(user.id).toBe("user-1");
      expect(user.name).toBe("John");
      expect(user.email).toBe("john@example.com");
    });

    it("should store props correctly", () => {
      const props: UserProps = { name: "Jane", email: "jane@example.com" };
      const user = new User(props, "user-2");

      expect(user.name).toBe("Jane");
      expect(user.email).toBe("jane@example.com");
    });

    it("should handle different id types", () => {
      class Product extends Entity<{ title: string }, number> {
        getTitle(): string {
          return this.props.title;
        }
      }

      const product = new Product({ title: "Laptop" }, 123);

      expect(product.id).toBe(123);
      expect(typeof product.id).toBe("number");
    });

    it("should handle complex id types", () => {
      interface UuidProps {
        value: string;
      }

      const props: UuidProps = { value: "12345" };
      const user = new User(props as unknown as UserProps, "550e8400-e29b-41d4-a716-446655440000");

      expect(user.id).toBe("550e8400-e29b-41d4-a716-446655440000");
    });
  });

  describe("id getter", () => {
    it("should return the id passed in constructor", () => {
      const user = new User({ name: "John", email: "john@example.com" }, "user-123");

      expect(user.id).toBe("user-123");
    });

    it("should return id consistently across multiple accesses", () => {
      const user = new User({ name: "John", email: "john@example.com" }, "user-456");

      expect(user.id).toBe("user-456");
      expect(user.id).toBe("user-456");
      expect(user.id).toBe("user-456");
    });
  });

  describe("equals()", () => {
    let user1: User;
    let user2WithSameId: User;
    let user3WithDifferentId: User;

    beforeEach(() => {
      user1 = new User({ name: "John", email: "john@example.com" }, "user-1");
      user2WithSameId = new User({ name: "Jane", email: "jane@example.com" }, "user-1");
      user3WithDifferentId = new User({ name: "John", email: "john@example.com" }, "user-2");
    });

    it("should return true when comparing same instance", () => {
      expect(user1.equals(user1)).toBe(true);
    });

    it("should return true when comparing entities with same id", () => {
      expect(user1.equals(user2WithSameId)).toBe(true);
    });

    it("should return false when comparing entities with different ids", () => {
      expect(user1.equals(user3WithDifferentId)).toBe(false);
    });

    it("should return false when comparing with null", () => {
      expect(user1.equals(null as unknown as User)).toBe(false);
    });

    it("should return false when comparing with undefined", () => {
      expect(user1.equals(undefined)).toBe(false);
    });

    it("should return false when comparing with non-Entity object", () => {
      const plainObject = { id: "user-1" };

      expect(user1.equals(plainObject as unknown as User)).toBe(false);
    });

    it("should return false when comparing with object that looks like entity but isnt", () => {
      const fakeEntity = {
        _id: "user-1",
        props: { name: "John" },
        equals: () => true,
      };

      expect(user1.equals(fakeEntity as unknown as User)).toBe(false);
    });

    it("should treat entities with same id as equal regardless of props", () => {
      const userA = new User({ name: "Original", email: "original@example.com" }, "user-1");
      const userB = new User({ name: "Modified", email: "modified@example.com" }, "user-1");

      expect(userA.equals(userB)).toBe(true);
      // But props are different
      expect(userA.name).not.toBe(userB.name);
    });

    it("should support comparison with subclasses", () => {
      class Admin extends Entity<UserProps, string> {
        get name(): string {
          return this.props.name;
        }
      }

      const user = new User({ name: "John", email: "john@example.com" }, "user-1");
      const admin = new Admin({ name: "Jane", email: "jane@example.com" }, "user-1");

      // Different classes, but same id - should be equal
      expect(user.equals(admin)).toBe(true);
    });

    it("should follow equality semantics: if a.equals(b) then b.equals(a)", () => {
      const a = new User({ name: "Alice", email: "alice@example.com" }, "user-1");
      const b = new User({ name: "Bob", email: "bob@example.com" }, "user-1");

      expect(a.equals(b)).toBe(b.equals(a));
    });

    it("should be transitive: if a.equals(b) and b.equals(c) then a.equals(c)", () => {
      const a = new User({ name: "A", email: "a@example.com" }, "user-1");
      const b = new User({ name: "B", email: "b@example.com" }, "user-1");
      const c = new User({ name: "C", email: "c@example.com" }, "user-1");

      expect(a.equals(b)).toBe(true);
      expect(b.equals(c)).toBe(true);
      expect(a.equals(c)).toBe(true);
    });
  });

  describe("Entity identity semantics", () => {
    it("should distinguish entities by id not by value", () => {
      const user1 = new User({ name: "John", email: "john@example.com" }, "user-1");
      const user2 = new User({ name: "John", email: "john@example.com" }, "user-2");

      // Same values but different ids
      expect(user1.name).toBe(user2.name);
      expect(user1.email).toBe(user2.email);
      // Should not be equal
      expect(user1.equals(user2)).toBe(false);
    });

    it("should allow same id with different state over time (simulated)", () => {
      const user = new User({ name: "John", email: "john@example.com" }, "user-1");
      const updatedUser = new User(
        { name: "John Updated", email: "updated@example.com" },
        "user-1",
      );

      // Different props, same id
      expect(user.name).not.toBe(updatedUser.name);
      // But logically same entity
      expect(user.equals(updatedUser)).toBe(true);
    });
  });

  describe("Multiple entity types", () => {
    it("should work with different entity types", () => {
      interface ProductProps {
        title: string;
        price: number;
      }

      class Product extends Entity<ProductProps, string> {
        get title(): string {
          return this.props.title;
        }

        get price(): number {
          return this.props.price;
        }
      }

      const user = new User({ name: "John", email: "john@example.com" }, "user-1");
      const product = new Product({ title: "Laptop", price: 999 }, "prod-1");

      expect(user.id).toBe("user-1");
      expect(product.id).toBe("prod-1");
      expect(user.equals(product as unknown as User)).toBe(false);
    });
  });
});
