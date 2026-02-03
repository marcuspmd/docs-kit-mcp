import { describe, it, expect } from "@jest/globals";
import { Signature } from "../Signature.js";

describe("Signature Value Object", () => {
  describe("create()", () => {
    it("should create with raw signature and all details", () => {
      const sig = Signature.create({
        raw: "public async getUserById(id: string): Promise<User>",
        parameters: ["id"],
        returnType: "Promise<User>",
        typeParameters: ["T"],
        modifiers: ["public", "async"],
      });

      expect(sig.raw).toBe("public async getUserById(id: string): Promise<User>");
      expect(sig.parameters).toEqual(["id"]);
      expect(sig.returnType).toBe("Promise<User>");
      expect(sig.typeParameters).toEqual(["T"]);
      expect(sig.modifiers).toEqual(["public", "async"]);
    });

    it("should create with minimal properties", () => {
      const sig = Signature.create({
        raw: "function test()",
      });

      expect(sig.raw).toBe("function test()");
      expect(sig.parameters).toEqual([]);
      expect(sig.returnType).toBeUndefined();
      expect(sig.typeParameters).toEqual([]);
      expect(sig.modifiers).toEqual([]);
    });
  });

  describe("fromRaw()", () => {
    it("should create from raw string only", () => {
      const sig = Signature.fromRaw("public void doSomething()");

      expect(sig.raw).toBe("public void doSomething()");
      expect(sig.parameters).toEqual([]);
      expect(sig.modifiers).toEqual([]);
    });
  });

  describe("Getters", () => {
    it("should return all properties", () => {
      const sig = Signature.create({
        raw: "async function*generator<T>(param: T[]): AsyncGenerator<T>",
        parameters: ["param"],
        returnType: "AsyncGenerator<T>",
        typeParameters: ["T"],
        modifiers: ["async"],
      });

      expect(sig.raw).toBe("async function*generator<T>(param: T[]): AsyncGenerator<T>");
      expect(sig.parameters).toEqual(["param"]);
      expect(sig.returnType).toBe("AsyncGenerator<T>");
      expect(sig.typeParameters).toEqual(["T"]);
      expect(sig.modifiers).toEqual(["async"]);
    });

    it("should return empty arrays for undefined properties", () => {
      const sig = Signature.create({ raw: "test()" });

      expect(sig.parameters).toEqual([]);
      expect(sig.typeParameters).toEqual([]);
      expect(sig.modifiers).toEqual([]);
    });
  });

  describe("hasModifier()", () => {
    it("should return true when modifier exists", () => {
      const sig = Signature.create({
        raw: "public static async method()",
        modifiers: ["public", "static", "async"],
      });

      expect(sig.hasModifier("public")).toBe(true);
      expect(sig.hasModifier("static")).toBe(true);
      expect(sig.hasModifier("async")).toBe(true);
    });

    it("should return false when modifier does not exist", () => {
      const sig = Signature.create({
        raw: "public method()",
        modifiers: ["public"],
      });

      expect(sig.hasModifier("private")).toBe(false);
      expect(sig.hasModifier("static")).toBe(false);
    });

    it("should handle empty modifiers", () => {
      const sig = Signature.create({ raw: "method()" });

      expect(sig.hasModifier("public")).toBe(false);
      expect(sig.hasModifier("async")).toBe(false);
    });
  });

  describe("isAsync()", () => {
    it("should return true for async functions", () => {
      const sig = Signature.create({
        raw: "async function test()",
        modifiers: ["async"],
      });

      expect(sig.isAsync()).toBe(true);
    });

    it("should return false for non-async functions", () => {
      const sig = Signature.create({
        raw: "function test()",
        modifiers: ["public"],
      });

      expect(sig.isAsync()).toBe(false);
    });

    it("should return false when no modifiers", () => {
      const sig = Signature.create({ raw: "function test()" });

      expect(sig.isAsync()).toBe(false);
    });
  });

  describe("isStatic()", () => {
    it("should return true for static methods", () => {
      const sig = Signature.create({
        raw: "static create()",
        modifiers: ["static"],
      });

      expect(sig.isStatic()).toBe(true);
    });

    it("should return false for non-static methods", () => {
      const sig = Signature.create({
        raw: "method()",
        modifiers: ["public"],
      });

      expect(sig.isStatic()).toBe(false);
    });
  });

  describe("isAbstract()", () => {
    it("should return true for abstract methods", () => {
      const sig = Signature.create({
        raw: "abstract method()",
        modifiers: ["abstract", "protected"],
      });

      expect(sig.isAbstract()).toBe(true);
    });

    it("should return false for concrete methods", () => {
      const sig = Signature.create({
        raw: "method()",
        modifiers: [],
      });

      expect(sig.isAbstract()).toBe(false);
    });
  });

  describe("toString()", () => {
    it("should return raw signature", () => {
      const raw = "public async getUserById(id: string): Promise<User>";
      const sig = Signature.create({ raw });

      expect(sig.toString()).toBe(raw);
    });
  });

  describe("Value Object Equality", () => {
    it("should consider signatures with same properties as equal", () => {
      const props = {
        raw: "public void test()",
        parameters: ["param"],
        modifiers: ["public"],
      };

      const sig1 = Signature.create(props);
      const sig2 = Signature.create(props);

      expect(sig1.equals(sig2)).toBe(true);
    });

    it("should consider signatures with different properties as not equal", () => {
      const sig1 = Signature.create({
        raw: "public method()",
        modifiers: ["public"],
      });

      const sig2 = Signature.create({
        raw: "private method()",
        modifiers: ["private"],
      });

      expect(sig1.equals(sig2)).toBe(false);
    });

    it("should handle null comparison", () => {
      const sig = Signature.create({ raw: "test()" });

      expect(sig.equals(null as unknown as Signature)).toBe(false);
    });

    it("should handle undefined comparison", () => {
      const sig = Signature.create({ raw: "test()" });

      expect(sig.equals(undefined)).toBe(false);
    });
  });

  describe("Complex signatures", () => {
    it("should handle generic method signature", () => {
      const sig = Signature.create({
        raw: "public static <T extends Comparable<T>> int compareTo(T other)",
        parameters: ["other"],
        returnType: "int",
        typeParameters: ["T"],
        modifiers: ["public", "static"],
      });

      expect(sig.isStatic()).toBe(true);
      expect(sig.typeParameters).toContain("T");
      expect(sig.parameters).toContain("other");
    });

    it("should handle lambda signature", () => {
      const sig = Signature.create({
        raw: "(String name, int age) -> void",
        parameters: ["name", "age"],
        returnType: "void",
      });

      expect(sig.parameters.length).toBe(2);
      expect(sig.returnType).toBe("void");
    });

    it("should handle constructor signature", () => {
      const sig = Signature.create({
        raw: "public UserService(UserRepository repo)",
        parameters: ["repo"],
        modifiers: ["public"],
      });

      expect(sig.modifiers).toContain("public");
      expect(sig.parameters).toContain("repo");
    });
  });
});
