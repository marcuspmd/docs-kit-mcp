import { describe, it, expect } from "@jest/globals";
import { ValueObject } from "../ValueObject.js";

describe("ValueObject Base Class", () => {
  // Create a concrete implementation for testing
  class TestValueObject extends ValueObject<{ name: string; value: number }> {
    get name(): string {
      return this.props.name;
    }

    get value(): number {
      return this.props.value;
    }
  }

  describe("constructor", () => {
    it("should create value object with props", () => {
      const vo = new TestValueObject({ name: "test", value: 42 });

      expect(vo.name).toBe("test");
      expect(vo.value).toBe(42);
    });

    it("should freeze properties", () => {
      const vo = new TestValueObject({ name: "immutable", value: 100 });

      expect(Object.isFrozen(vo["props"])).toBe(true);
    });

    it("should make props immutable", () => {
      const vo = new TestValueObject({ name: "test", value: 1 });

      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (vo as any).props.name = "modified";
      }).toThrow();
    });
  });

  describe("equals()", () => {
    it("should return true for value objects with same properties", () => {
      const vo1 = new TestValueObject({ name: "test", value: 42 });
      const vo2 = new TestValueObject({ name: "test", value: 42 });

      expect(vo1.equals(vo2)).toBe(true);
    });

    it("should return false for value objects with different properties", () => {
      const vo1 = new TestValueObject({ name: "test", value: 42 });
      const vo2 = new TestValueObject({ name: "test", value: 43 });

      expect(vo1.equals(vo2)).toBe(false);
    });

    it("should return false when comparing with null", () => {
      const vo = new TestValueObject({ name: "test", value: 42 });

      expect(vo.equals(null as unknown as TestValueObject)).toBe(false);
    });

    it("should return false when comparing with undefined", () => {
      const vo = new TestValueObject({ name: "test", value: 42 });

      expect(vo.equals(undefined)).toBe(false);
    });

    it("should return false for object without props", () => {
      const vo = new TestValueObject({ name: "test", value: 42 });
      const invalidObj = { name: "test" } as unknown as TestValueObject;

      expect(vo.equals(invalidObj)).toBe(false);
    });
  });

  describe("propsEqual()", () => {
    it("should use JSON stringify for comparison", () => {
      const vo1 = new TestValueObject({ name: "test", value: 42 });
      const vo2 = new TestValueObject({ name: "test", value: 42 });

      // propsEqual is protected but equals calls it
      expect(vo1.equals(vo2)).toBe(true);
    });

    it("should handle complex nested properties", () => {
      class ComplexVO extends ValueObject<{ data: { nested: string } }> {}

      const vo1 = new ComplexVO({ data: { nested: "value" } });
      const vo2 = new ComplexVO({ data: { nested: "value" } });
      const vo3 = new ComplexVO({ data: { nested: "different" } });

      expect(vo1.equals(vo2)).toBe(true);
      expect(vo1.equals(vo3)).toBe(false);
    });
  });

  describe("toValue()", () => {
    it("should return a copy of props", () => {
      const props = { name: "test", value: 42 };
      const vo = new TestValueObject(props);

      const value = vo.toValue();

      expect(value).toEqual(props);
      expect(value).not.toBe(props);
    });

    it("should return a separate object", () => {
      const vo = new TestValueObject({ name: "test", value: 42 });

      const value1 = vo.toValue();
      const value2 = vo.toValue();

      expect(value1).toEqual(value2);
      expect(value1).not.toBe(value2);
    });

    it("should allow modification of returned value without affecting VO", () => {
      const vo = new TestValueObject({ name: "original", value: 1 });

      const value = vo.toValue();
      value.name = "modified";
      value.value = 999;

      expect(vo.name).toBe("original");
      expect(vo.value).toBe(1);
    });
  });

  describe("Immutability", () => {
    it("should prevent modification of properties through original assignment", () => {
      const vo = new TestValueObject({ name: "immutable", value: 10 });

      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (vo as any).props.name = "changed";
      }).toThrow();
    });

    it("should preserve immutability across multiple accesses", () => {
      const vo = new TestValueObject({ name: "test", value: 42 });

      const first = vo.toValue();
      const second = vo.toValue();
      first.name = "modified";

      expect(second.name).toBe("test");
      expect(vo.name).toBe("test");
    });
  });

  describe("Type safety with different properties", () => {
    it("should work with string properties", () => {
      class StringVO extends ValueObject<{ text: string }> {
        getText(): string {
          return this.props.text;
        }
      }

      const vo = new StringVO({ text: "hello" });

      expect(vo.getText()).toBe("hello");
    });

    it("should work with array properties", () => {
      class ArrayVO extends ValueObject<{ items: string[] }> {
        getItems(): string[] {
          return this.props.items;
        }
      }

      const vo = new ArrayVO({ items: ["a", "b", "c"] });

      expect(vo.getItems()).toEqual(["a", "b", "c"]);
    });

    it("should work with nested object properties", () => {
      interface Address {
        street: string;
        city: string;
        zip: string;
      }

      class AddressVO extends ValueObject<Address> {
        getCity(): string {
          return this.props.city;
        }
      }

      const vo = new AddressVO({ street: "123 Main", city: "NYC", zip: "10001" });

      expect(vo.getCity()).toBe("NYC");
    });
  });

  describe("Comparison semantics", () => {
    it("should represent value equality not identity", () => {
      const vo1 = new TestValueObject({ name: "test", value: 42 });
      const vo2 = new TestValueObject({ name: "test", value: 42 });

      // Different instances but same value
      expect(vo1).not.toBe(vo2);
      expect(vo1.equals(vo2)).toBe(true);
    });

    it("should follow transitivity", () => {
      const vo1 = new TestValueObject({ name: "test", value: 42 });
      const vo2 = new TestValueObject({ name: "test", value: 42 });
      const vo3 = new TestValueObject({ name: "test", value: 42 });

      expect(vo1.equals(vo2)).toBe(true);
      expect(vo2.equals(vo3)).toBe(true);
      expect(vo1.equals(vo3)).toBe(true);
    });
  });
});
