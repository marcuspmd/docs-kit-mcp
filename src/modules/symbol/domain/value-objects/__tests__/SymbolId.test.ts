import { describe, it, expect } from "@jest/globals";
import { SymbolId } from "../SymbolId.js";

describe("SymbolId Value Object", () => {
  describe("create()", () => {
    it("should create deterministic ID from file, name, and kind", () => {
      const id1 = SymbolId.create("src/services/UserService.ts", "UserService", "class");
      const id2 = SymbolId.create("src/services/UserService.ts", "UserService", "class");

      expect(id1.value).toBe(id2.value);
    });

    it("should create different IDs for different files", () => {
      const id1 = SymbolId.create("src/services/UserService.ts", "UserService", "class");
      const id2 = SymbolId.create("src/services/OrderService.ts", "UserService", "class");

      expect(id1.value).not.toBe(id2.value);
    });

    it("should create different IDs for different names", () => {
      const id1 = SymbolId.create("src/services/UserService.ts", "UserService", "class");
      const id2 = SymbolId.create("src/services/UserService.ts", "OrderService", "class");

      expect(id1.value).not.toBe(id2.value);
    });

    it("should create different IDs for different kinds", () => {
      const id1 = SymbolId.create("src/services/UserService.ts", "UserService", "class");
      const id2 = SymbolId.create("src/services/UserService.ts", "UserService", "interface");

      expect(id1.value).not.toBe(id2.value);
    });

    it("should produce 16-character hash", () => {
      const id = SymbolId.create("src/test.ts", "test", "function");

      expect(id.value).toHaveLength(16);
    });

    it("should contain only hex characters", () => {
      const id = SymbolId.create("src/test.ts", "test", "function");

      expect(/^[0-9a-f]{16}$/.test(id.value)).toBe(true);
    });
  });

  describe("fromValue()", () => {
    it("should create SymbolId from existing value", () => {
      const value = "abc123def456789f";
      const id = SymbolId.fromValue(value);

      expect(id.value).toBe(value);
    });

    it("should preserve any valid string format", () => {
      const value = "custom.id.value";
      const id = SymbolId.fromValue(value);

      expect(id.value).toBe(value);
    });
  });

  describe("Getters", () => {
    it("should return value", () => {
      const id = SymbolId.create("src/test.ts", "test", "function");

      expect(id.value).toBeDefined();
      expect(typeof id.value).toBe("string");
    });
  });

  describe("toString()", () => {
    it("should return the ID value", () => {
      const id = SymbolId.create("src/test.ts", "test", "function");

      expect(id.toString()).toBe(id.value);
    });

    it("should be useful for logging", () => {
      const id = SymbolId.create("src/services/UserService.ts", "UserService", "class");
      const str = `Symbol ID: ${id.toString()}`;

      expect(str).toContain("Symbol ID:");
      expect(str).toHaveLength(str.length); // Just verify it's a string
    });
  });

  describe("Value Object Equality", () => {
    it("should consider IDs with same value as equal", () => {
      const id1 = SymbolId.create("src/test.ts", "test", "function");
      const id2 = SymbolId.create("src/test.ts", "test", "function");

      expect(id1.equals(id2)).toBe(true);
    });

    it("should consider IDs with different values as not equal", () => {
      const id1 = SymbolId.create("src/test.ts", "test", "function");
      const id2 = SymbolId.create("src/test.ts", "other", "function");

      expect(id1.equals(id2)).toBe(false);
    });

    it("should handle fromValue equality", () => {
      const value = "same123value90f";
      const id1 = SymbolId.fromValue(value);
      const id2 = SymbolId.fromValue(value);

      expect(id1.equals(id2)).toBe(true);
    });

    it("should handle null comparison", () => {
      const id = SymbolId.create("src/test.ts", "test", "function");

      expect(id.equals(null as unknown as SymbolId)).toBe(false);
    });

    it("should handle undefined comparison", () => {
      const id = SymbolId.create("src/test.ts", "test", "function");

      expect(id.equals(undefined)).toBe(false);
    });
  });

  describe("toValue()", () => {
    it("should return the ID value", () => {
      const id = SymbolId.create("src/test.ts", "test", "function");
      const value = id.toValue();

      expect(value.value).toBe(id.value);
    });
  });

  describe("Determinism", () => {
    it("should produce same ID over multiple calls", () => {
      const values = [
        SymbolId.create("src/test.ts", "myFunc", "function"),
        SymbolId.create("src/test.ts", "myFunc", "function"),
        SymbolId.create("src/test.ts", "myFunc", "function"),
      ];

      expect(values[0].value).toBe(values[1].value);
      expect(values[1].value).toBe(values[2].value);
    });

    it("should handle complex file paths consistently", () => {
      const paths = [
        "src/modules/symbol/domain/entities/CodeSymbol.ts",
        "src/modules/symbol/domain/entities/CodeSymbol.ts",
      ];

      const id1 = SymbolId.create(paths[0], "CodeSymbol", "class");
      const id2 = SymbolId.create(paths[1], "CodeSymbol", "class");

      expect(id1.value).toBe(id2.value);
    });

    it("should be case-sensitive", () => {
      const id1 = SymbolId.create("src/test.ts", "UserService", "class");
      const id2 = SymbolId.create("src/test.ts", "userservice", "class");

      expect(id1.value).not.toBe(id2.value);
    });
  });
});
