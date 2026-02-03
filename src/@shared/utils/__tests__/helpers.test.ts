import { describe, it, expect } from "@jest/globals";
import {
  generateId,
  generateHash,
  generateSymbolId,
  normalizePath,
  getFileExtension,
  isDefined,
  deepClone,
  groupBy,
  chunk,
  unique,
  delay,
} from "../helpers.js";

describe("Shared Helpers Utilities", () => {
  describe("generateId()", () => {
    it("should generate a UUID", () => {
      const id = generateId();
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });

    it("should generate unique IDs", () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it("should follow UUID format", () => {
      const id = generateId();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(uuidRegex.test(id)).toBe(true);
    });
  });

  describe("generateHash()", () => {
    it("should generate hash for string", async () => {
      const hash = await generateHash("test input");
      expect(typeof hash).toBe("string");
      expect(hash.length).toBe(64); // SHA-256 in hex
    });

    it("should generate consistent hash for same input", async () => {
      const hash1 = await generateHash("test");
      const hash2 = await generateHash("test");
      expect(hash1).toBe(hash2);
    });

    it("should generate different hash for different input", async () => {
      const hash1 = await generateHash("test1");
      const hash2 = await generateHash("test2");
      expect(hash1).not.toBe(hash2);
    });

    it("should handle empty string", async () => {
      const hash = await generateHash("");
      expect(typeof hash).toBe("string");
      expect(hash.length).toBe(64);
    });
  });

  describe("generateSymbolId()", () => {
    it("should generate deterministic ID", () => {
      const id1 = generateSymbolId("src/test.ts", "TestClass", "class");
      const id2 = generateSymbolId("src/test.ts", "TestClass", "class");
      expect(id1).toBe(id2);
    });

    it("should generate different IDs for different inputs", () => {
      const id1 = generateSymbolId("src/test1.ts", "A", "class");
      const id2 = generateSymbolId("src/test2.ts", "A", "class");
      expect(id1).not.toBe(id2);
    });

    it("should return 8-character hex string", () => {
      const id = generateSymbolId("src/test.ts", "test", "function");
      expect(/^[0-9a-f]{8}$/.test(id)).toBe(true);
    });
  });

  describe("normalizePath()", () => {
    it("should convert backslashes to forward slashes", () => {
      const path = "src\\modules\\symbol\\test.ts";
      const normalized = normalizePath(path);
      expect(normalized).toBe("src/modules/symbol/test.ts");
    });

    it("should handle mixed slashes", () => {
      const path = "src\\modules/symbol\\test.ts";
      const normalized = normalizePath(path);
      expect(normalized).toBe("src/modules/symbol/test.ts");
    });

    it("should not affect forward slashes", () => {
      const path = "src/modules/symbol/test.ts";
      const normalized = normalizePath(path);
      expect(normalized).toBe("src/modules/symbol/test.ts");
    });
  });

  describe("getFileExtension()", () => {
    it("should extract extension from filename", () => {
      expect(getFileExtension("test.ts")).toBe("ts");
      expect(getFileExtension("script.js")).toBe("js");
      expect(getFileExtension("data.json")).toBe("json");
    });

    it("should return lowercase extension", () => {
      expect(getFileExtension("TEST.TS")).toBe("ts");
      expect(getFileExtension("File.TXT")).toBe("txt");
    });

    it("should handle multiple dots", () => {
      expect(getFileExtension("archive.tar.gz")).toBe("gz");
      expect(getFileExtension("config.test.js")).toBe("js");
    });

    it("should return empty string for no extension", () => {
      expect(getFileExtension("README")).toBe("");
      expect(getFileExtension("Makefile")).toBe("");
    });

    it("should return empty string for hidden files", () => {
      expect(getFileExtension(".gitignore")).toBe("");
    });

    it("should handle paths with directories", () => {
      expect(getFileExtension("src/modules/test.ts")).toBe("ts");
      expect(getFileExtension("/home/user/file.txt")).toBe("txt");
    });
  });

  describe("isDefined()", () => {
    it("should return true for defined values", () => {
      expect(isDefined(0)).toBe(true);
      expect(isDefined("")).toBe(true);
      expect(isDefined(false)).toBe(true);
      expect(isDefined({})).toBe(true);
      expect(isDefined([])).toBe(true);
    });

    it("should return false for null", () => {
      expect(isDefined(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isDefined(undefined)).toBe(false);
    });

    it("should work as type guard", () => {
      const value: string | null | undefined = "test";
      if (isDefined(value)) {
        expect(value.length).toBe(4);
      }
    });
  });

  describe("deepClone()", () => {
    it("should clone primitive values", () => {
      expect(deepClone(42)).toBe(42);
      expect(deepClone("test")).toBe("test");
      expect(deepClone(true)).toBe(true);
    });

    it("should clone objects", () => {
      const obj = { name: "test", value: 42 };
      const cloned = deepClone(obj);
      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
    });

    it("should clone nested objects", () => {
      const obj = { user: { name: "John", address: { city: "NYC" } } };
      const cloned = deepClone(obj);
      expect(cloned).toEqual(obj);
      expect(cloned.user).not.toBe(obj.user);
      expect(cloned.user.address).not.toBe(obj.user.address);
    });

    it("should clone arrays", () => {
      const arr = [1, 2, 3];
      const cloned = deepClone(arr);
      expect(cloned).toEqual(arr);
      expect(cloned).not.toBe(arr);
    });

    it("should clone arrays of objects", () => {
      const arr = [{ id: 1 }, { id: 2 }];
      const cloned = deepClone(arr);
      expect(cloned).toEqual(arr);
      expect(cloned[0]).not.toBe(arr[0]);
    });
  });

  describe("groupBy()", () => {
    it("should group items by key function", () => {
      const items = [
        { category: "A", value: 1 },
        { category: "B", value: 2 },
        { category: "A", value: 3 },
      ];

      const grouped = groupBy(items, (item) => item.category);

      expect(grouped.A).toEqual([
        { category: "A", value: 1 },
        { category: "A", value: 3 },
      ]);
      expect(grouped.B).toEqual([{ category: "B", value: 2 }]);
    });

    it("should handle empty array", () => {
      const grouped = groupBy([], (item) => item);
      expect(grouped).toEqual({});
    });

    it("should work with string keys", () => {
      const items = ["apple", "apricot", "banana"];
      const grouped = groupBy(items, (item) => item.charAt(0));

      expect(grouped.a).toEqual(["apple", "apricot"]);
      expect(grouped.b).toEqual(["banana"]);
    });

    it("should work with number keys", () => {
      const items = [1, 2, 3, 4];
      const grouped = groupBy(items, (item) => item % 2);

      expect(grouped[0]).toEqual([2, 4]);
      expect(grouped[1]).toEqual([1, 3]);
    });
  });

  describe("chunk()", () => {
    it("should chunk array into sized pieces", () => {
      const arr = [1, 2, 3, 4, 5];
      const chunks = chunk(arr, 2);

      expect(chunks).toEqual([[1, 2], [3, 4], [5]]);
    });

    it("should handle exact division", () => {
      const arr = [1, 2, 3, 4];
      const chunks = chunk(arr, 2);

      expect(chunks).toEqual([
        [1, 2],
        [3, 4],
      ]);
    });

    it("should handle chunk size larger than array", () => {
      const arr = [1, 2];
      const chunks = chunk(arr, 5);

      expect(chunks).toEqual([[1, 2]]);
    });

    it("should handle empty array", () => {
      const chunks = chunk([], 2);
      expect(chunks).toEqual([]);
    });

    it("should handle size of 1", () => {
      const arr = [1, 2, 3];
      const chunks = chunk(arr, 1);

      expect(chunks).toEqual([[1], [2], [3]]);
    });
  });

  describe("unique()", () => {
    it("should remove duplicates from array", () => {
      const arr = [1, 2, 2, 3, 3, 3];
      const result = unique(arr);

      expect(result).toEqual([1, 2, 3]);
    });

    it("should preserve order", () => {
      const arr = [3, 1, 2, 1, 3];
      const result = unique(arr);

      expect(result[0]).toBe(3);
      expect(result[1]).toBe(1);
      expect(result[2]).toBe(2);
    });

    it("should handle strings", () => {
      const arr = ["a", "b", "a", "c", "b"];
      const result = unique(arr);

      expect(result).toContain("a");
      expect(result).toContain("b");
      expect(result).toContain("c");
      expect(result.length).toBe(3);
    });

    it("should handle empty array", () => {
      const result = unique([]);
      expect(result).toEqual([]);
    });

    it("should handle already unique array", () => {
      const arr = [1, 2, 3];
      const result = unique(arr);
      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe("delay()", () => {
    it("should resolve after specified time", async () => {
      const start = Date.now();
      await delay(10);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(10);
    });

    it("should return resolved promise", async () => {
      const result = await delay(5);
      expect(result).toBeUndefined();
    });

    it("should handle zero delay", async () => {
      const result = await delay(0);
      expect(result).toBeUndefined();
    });
  });
});
