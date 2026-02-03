import { describe, it, expect } from "@jest/globals";
import { SymbolKind, SymbolKindSchema } from "../SymbolKind.js";

describe("SymbolKind Value Object", () => {
  describe("create()", () => {
    it("should create with valid symbol kind", () => {
      const kind = SymbolKind.create("class");

      expect(kind.value).toBe("class");
    });

    it("should accept all predefined kinds", () => {
      const kinds = [
        "class",
        "abstract_class",
        "interface",
        "enum",
        "type",
        "trait",
        "method",
        "function",
        "constructor",
        "lambda",
        "dto",
        "entity",
        "value_object",
        "event",
        "listener",
        "service",
        "repository",
        "use_case",
        "controller",
        "command",
        "query",
        "handler",
        "factory",
        "builder",
        "model",
        "schema",
        "migration",
        "middleware",
        "provider",
        "component",
        "test",
        "mock",
      ] as const;

      kinds.forEach((kind) => {
        const sk = SymbolKind.create(kind);
        expect(sk.value).toBe(kind);
      });
    });
  });

  describe("fromString()", () => {
    it("should create from valid string", () => {
      const kind = SymbolKind.fromString("function");

      expect(kind.value).toBe("function");
    });

    it("should throw on invalid string", () => {
      expect(() => {
        SymbolKind.fromString("invalid_kind");
      }).toThrow("Invalid symbol kind");
    });
  });

  describe("Getters", () => {
    it("should return value", () => {
      const kind = SymbolKind.create("interface");

      expect(kind.value).toBe("interface");
    });
  });

  describe("isClass()", () => {
    it("should return true for class", () => {
      const kind = SymbolKind.create("class");

      expect(kind.isClass()).toBe(true);
    });

    it("should return true for abstract_class", () => {
      const kind = SymbolKind.create("abstract_class");

      expect(kind.isClass()).toBe(true);
    });

    it("should return false for other kinds", () => {
      const kinds: Array<"interface" | "function" | "enum"> = ["interface", "function", "enum"];

      kinds.forEach((k) => {
        const kind = SymbolKind.create(k);
        expect(kind.isClass()).toBe(false);
      });
    });
  });

  describe("isFunction()", () => {
    it("should return true for function", () => {
      const kind = SymbolKind.create("function");

      expect(kind.isFunction()).toBe(true);
    });

    it("should return true for method", () => {
      const kind = SymbolKind.create("method");

      expect(kind.isFunction()).toBe(true);
    });

    it("should return true for lambda", () => {
      const kind = SymbolKind.create("lambda");

      expect(kind.isFunction()).toBe(true);
    });

    it("should return false for non-function kinds", () => {
      const kind = SymbolKind.create("class");

      expect(kind.isFunction()).toBe(false);
    });
  });

  describe("isType()", () => {
    it("should return true for type", () => {
      const kind = SymbolKind.create("type");

      expect(kind.isType()).toBe(true);
    });

    it("should return true for interface", () => {
      const kind = SymbolKind.create("interface");

      expect(kind.isType()).toBe(true);
    });

    it("should return true for enum", () => {
      const kind = SymbolKind.create("enum");

      expect(kind.isType()).toBe(true);
    });

    it("should return false for non-type kinds", () => {
      const kind = SymbolKind.create("class");

      expect(kind.isType()).toBe(false);
    });
  });

  describe("toString()", () => {
    it("should return the kind value", () => {
      const kind = SymbolKind.create("service");

      expect(kind.toString()).toBe("service");
    });
  });

  describe("Value Object Equality", () => {
    it("should consider kinds with same value as equal", () => {
      const kind1 = SymbolKind.create("class");
      const kind2 = SymbolKind.create("class");

      expect(kind1.equals(kind2)).toBe(true);
    });

    it("should consider kinds with different values as not equal", () => {
      const kind1 = SymbolKind.create("class");
      const kind2 = SymbolKind.create("interface");

      expect(kind1.equals(kind2)).toBe(false);
    });

    it("should handle null comparison", () => {
      const kind = SymbolKind.create("function");

      expect(kind.equals(null as unknown as SymbolKind)).toBe(false);
    });

    it("should handle undefined comparison", () => {
      const kind = SymbolKind.create("function");

      expect(kind.equals(undefined)).toBe(false);
    });
  });

  describe("toValue()", () => {
    it("should return properties object", () => {
      const kind = SymbolKind.create("repository");
      const value = kind.toValue();

      expect(value.value).toBe("repository");
    });
  });

  describe("Schema validation", () => {
    it("should validate all predefined types", () => {
      const validTypes = ["class", "interface", "function", "method", "service", "repository"];

      validTypes.forEach((type) => {
        const result = SymbolKindSchema.safeParse(type);
        expect(result.success).toBe(true);
      });
    });

    it("should reject invalid types", () => {
      const result = SymbolKindSchema.safeParse("invalid_type");
      expect(result.success).toBe(false);
    });
  });

  describe("Domain classification", () => {
    it("should identify DDD patterns", () => {
      const dddKinds: Array<"entity" | "value_object" | "service" | "repository"> = [
        "entity",
        "value_object",
        "service",
        "repository",
      ];

      dddKinds.forEach((k) => {
        const kind = SymbolKind.create(k);
        expect(kind.value).toBeDefined();
      });
    });

    it("should identify architectural patterns", () => {
      const patterns: Array<"controller" | "use_case" | "factory" | "handler"> = [
        "controller",
        "use_case",
        "factory",
        "handler",
      ];

      patterns.forEach((p) => {
        const kind = SymbolKind.create(p);
        expect(kind.value).toBe(p);
      });
    });

    it("should identify testing patterns", () => {
      const testKinds: Array<"test" | "mock"> = ["test", "mock"];

      testKinds.forEach((t) => {
        const kind = SymbolKind.create(t);
        expect(kind.value).toBe(t);
      });
    });
  });

  describe("Composition scenarios", () => {
    it("should work with multiple classifications", () => {
      const serviceKind = SymbolKind.create("service");
      const repoKind = SymbolKind.create("repository");
      const classKind = SymbolKind.create("class");

      // Service might be a class
      expect(classKind.isClass()).toBe(true);

      // Verify distinct kinds
      expect(serviceKind.equals(repoKind)).toBe(false);
      expect(serviceKind.equals(classKind)).toBe(false);
    });

    it("should support domain-driven design check", () => {
      const kinds = [
        SymbolKind.create("entity"),
        SymbolKind.create("value_object"),
        SymbolKind.create("service"),
      ];

      // All should be valid domain concepts
      kinds.forEach((k) => {
        expect(k.value).toBeDefined();
        expect(k.toString()).toBeDefined();
      });
    });
  });
});
