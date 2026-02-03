import { describe, it, expect, beforeEach } from "@jest/globals";
import { FileLocation } from "../FileLocation.js";

describe("FileLocation Value Object", () => {
  const validProps = {
    filePath: "src/services/UserService.ts",
    startLine: 10,
    endLine: 25,
    startColumn: 2,
    endColumn: 80,
  };

  describe("create()", () => {
    it("should create with all properties", () => {
      const location = FileLocation.create(validProps);

      expect(location.filePath).toBe("src/services/UserService.ts");
      expect(location.startLine).toBe(10);
      expect(location.endLine).toBe(25);
      expect(location.startColumn).toBe(2);
      expect(location.endColumn).toBe(80);
    });

    it("should create with minimal properties", () => {
      const location = FileLocation.create({
        filePath: "test.ts",
        startLine: 1,
        endLine: 5,
      });

      expect(location.filePath).toBe("test.ts");
      expect(location.startLine).toBe(1);
      expect(location.endLine).toBe(5);
      expect(location.startColumn).toBeUndefined();
      expect(location.endColumn).toBeUndefined();
    });

    it("should allow same start and end line", () => {
      const location = FileLocation.create({
        filePath: "test.ts",
        startLine: 5,
        endLine: 5,
      });

      expect(location.startLine).toBe(5);
      expect(location.endLine).toBe(5);
      expect(location.lineCount).toBe(1);
    });

    it("should throw when endLine < startLine", () => {
      expect(() => {
        FileLocation.create({
          filePath: "test.ts",
          startLine: 25,
          endLine: 10,
        });
      }).toThrow("endLine must be greater than or equal to startLine");
    });
  });

  describe("Getters", () => {
    let location: FileLocation;

    beforeEach(() => {
      location = FileLocation.create(validProps);
    });

    it("should return filePath", () => {
      expect(location.filePath).toBe("src/services/UserService.ts");
    });

    it("should return startLine", () => {
      expect(location.startLine).toBe(10);
    });

    it("should return endLine", () => {
      expect(location.endLine).toBe(25);
    });

    it("should return startColumn", () => {
      expect(location.startColumn).toBe(2);
    });

    it("should return endColumn", () => {
      expect(location.endColumn).toBe(80);
    });

    it("should calculate lineCount correctly", () => {
      expect(location.lineCount).toBe(16); // 25 - 10 + 1
    });

    it("should calculate lineCount as 1 for single-line", () => {
      const singleLine = FileLocation.create({
        filePath: "test.ts",
        startLine: 10,
        endLine: 10,
      });

      expect(singleLine.lineCount).toBe(1);
    });
  });

  describe("contains()", () => {
    let location: FileLocation;

    beforeEach(() => {
      location = FileLocation.create({
        filePath: "test.ts",
        startLine: 10,
        endLine: 20,
      });
    });

    it("should return true for line within range", () => {
      expect(location.contains(10)).toBe(true);
      expect(location.contains(15)).toBe(true);
      expect(location.contains(20)).toBe(true);
    });

    it("should return false for line before start", () => {
      expect(location.contains(9)).toBe(false);
    });

    it("should return false for line after end", () => {
      expect(location.contains(21)).toBe(false);
    });

    it("should handle single-line location", () => {
      const singleLine = FileLocation.create({
        filePath: "test.ts",
        startLine: 10,
        endLine: 10,
      });

      expect(singleLine.contains(10)).toBe(true);
      expect(singleLine.contains(11)).toBe(false);
    });
  });

  describe("overlaps()", () => {
    let location1: FileLocation;

    beforeEach(() => {
      location1 = FileLocation.create({
        filePath: "src/test.ts",
        startLine: 10,
        endLine: 20,
      });
    });

    it("should return true for overlapping ranges in same file", () => {
      const location2 = FileLocation.create({
        filePath: "src/test.ts",
        startLine: 15,
        endLine: 25,
      });

      expect(location1.overlaps(location2)).toBe(true);
    });

    it("should return true when one contains the other", () => {
      const location2 = FileLocation.create({
        filePath: "src/test.ts",
        startLine: 12,
        endLine: 18,
      });

      expect(location1.overlaps(location2)).toBe(true);
    });

    it("should return true at exact boundaries", () => {
      const location2 = FileLocation.create({
        filePath: "src/test.ts",
        startLine: 20,
        endLine: 30,
      });

      expect(location1.overlaps(location2)).toBe(true);
    });

    it("should return false for non-overlapping ranges", () => {
      const location2 = FileLocation.create({
        filePath: "src/test.ts",
        startLine: 21,
        endLine: 30,
      });

      expect(location1.overlaps(location2)).toBe(false);
    });

    it("should return false for different files", () => {
      const location2 = FileLocation.create({
        filePath: "src/other.ts",
        startLine: 10,
        endLine: 20,
      });

      expect(location1.overlaps(location2)).toBe(false);
    });

    it("should return false when ranges are adjacent but not overlapping", () => {
      const location2 = FileLocation.create({
        filePath: "src/test.ts",
        startLine: 21,
        endLine: 22,
      });

      expect(location1.overlaps(location2)).toBe(false);
    });
  });

  describe("toString()", () => {
    it("should format single-line location", () => {
      const location = FileLocation.create({
        filePath: "src/test.ts",
        startLine: 10,
        endLine: 10,
      });

      expect(location.toString()).toBe("src/test.ts:10");
    });

    it("should format multi-line location", () => {
      const location = FileLocation.create({
        filePath: "src/test.ts",
        startLine: 10,
        endLine: 20,
      });

      expect(location.toString()).toBe("src/test.ts:10-20");
    });

    it("should include full path in string representation", () => {
      const location = FileLocation.create({
        filePath: "src/deeply/nested/module.ts",
        startLine: 5,
        endLine: 15,
      });

      expect(location.toString()).toContain("src/deeply/nested/module.ts");
    });
  });

  describe("Value Object Equality", () => {
    it("should consider locations with same properties as equal", () => {
      const loc1 = FileLocation.create(validProps);
      const loc2 = FileLocation.create(validProps);

      expect(loc1.equals(loc2)).toBe(true);
    });

    it("should consider locations with different properties as not equal", () => {
      const loc1 = FileLocation.create(validProps);
      const loc2 = FileLocation.create({
        ...validProps,
        startLine: 11,
      });

      expect(loc1.equals(loc2)).toBe(false);
    });

    it("should handle null comparison", () => {
      const location = FileLocation.create(validProps);

      expect(location.equals(null as unknown as FileLocation)).toBe(false);
    });

    it("should handle undefined comparison", () => {
      const location = FileLocation.create(validProps);

      expect(location.equals(undefined)).toBe(false);
    });
  });

  describe("toValue()", () => {
    it("should return a copy of properties", () => {
      const location = FileLocation.create(validProps);
      const value = location.toValue();

      expect(value.filePath).toBe("src/services/UserService.ts");
      expect(value.startLine).toBe(10);
      expect(value.endLine).toBe(25);
    });

    it("should return a new object (not same reference)", () => {
      const location = FileLocation.create(validProps);
      const value1 = location.toValue();
      const value2 = location.toValue();

      expect(value1).not.toBe(value2);
      expect(value1).toEqual(value2);
    });
  });

  describe("Immutability", () => {
    it("should freeze properties", () => {
      const location = FileLocation.create(validProps);

      // Should not be able to modify
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (location as any).filePath = "modified.ts";
      }).toThrow();
    });
  });
});
