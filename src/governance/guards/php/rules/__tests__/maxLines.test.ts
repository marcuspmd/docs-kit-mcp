/**
 * Tests for PHP Max Lines Rules
 */

import {
  PHP_MAX_LINES_CODE,
  createMaxLinesRule,
  PHP_MAX_LINES_CLASS_CODE,
  createMaxLinesClassRule,
} from "../maxLines.js";

describe("PHP Max Lines Rules", () => {
  describe("createMaxLinesRule", () => {
    it("should create rule with correct properties", () => {
      // Arrange & Act
      const rule = createMaxLinesRule();

      // Assert
      expect(rule.code).toBe(PHP_MAX_LINES_CODE);
      expect(rule.name).toBe("max-lines");
      expect(rule.description).toBe("Functions and methods should not exceed line count");
      expect(rule.type).toBe("max_lines");
      expect(rule.severity).toBe("warning");
      expect(rule.languages).toEqual(["php"]);
    });

    it("should have default max lines of 50", () => {
      // Arrange & Act
      const rule = createMaxLinesRule();

      // Assert
      expect(rule.defaultConfig.max).toBe(50);
    });

    it("should not specify kind (applies to functions and methods)", () => {
      // Arrange & Act
      const rule = createMaxLinesRule();

      // Assert
      expect(rule.defaultConfig.kind).toBeUndefined();
    });

    it("should have warning severity", () => {
      // Arrange & Act
      const rule = createMaxLinesRule();

      // Assert
      expect(rule.severity).toBe("warning");
    });

    it("should apply to PHP language", () => {
      // Arrange & Act
      const rule = createMaxLinesRule();

      // Assert
      expect(rule.languages).toContain("php");
      expect(rule.languages).toHaveLength(1);
    });
  });

  describe("createMaxLinesClassRule", () => {
    it("should create rule with correct properties", () => {
      // Arrange & Act
      const rule = createMaxLinesClassRule();

      // Assert
      expect(rule.code).toBe(PHP_MAX_LINES_CLASS_CODE);
      expect(rule.name).toBe("max-lines-class");
      expect(rule.description).toBe("Classes should not exceed line count (consider splitting)");
      expect(rule.type).toBe("max_lines");
      expect(rule.severity).toBe("warning");
      expect(rule.languages).toEqual(["php"]);
    });

    it("should have default max lines of 300 for classes", () => {
      // Arrange & Act
      const rule = createMaxLinesClassRule();

      // Assert
      expect(rule.defaultConfig.max).toBe(300);
    });

    it("should specify class kind", () => {
      // Arrange & Act
      const rule = createMaxLinesClassRule();

      // Assert
      expect(rule.defaultConfig.kind).toBe("class");
    });

    it("should have warning severity", () => {
      // Arrange & Act
      const rule = createMaxLinesClassRule();

      // Assert
      expect(rule.severity).toBe("warning");
    });

    it("should have higher threshold than function/method rule", () => {
      // Arrange & Act
      const functionRule = createMaxLinesRule();
      const classRule = createMaxLinesClassRule();

      // Assert
      expect(classRule.defaultConfig.max as number).toBeGreaterThan(
        functionRule.defaultConfig.max as number,
      );
    });
  });

  describe("Rule Codes", () => {
    it("should have unique codes for each rule", () => {
      // Arrange & Act
      const codes = [PHP_MAX_LINES_CODE, PHP_MAX_LINES_CLASS_CODE];

      // Assert
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);
    });

    it("should follow php namespace convention", () => {
      // Arrange & Act & Assert
      expect(PHP_MAX_LINES_CODE).toMatch(/^php:/);
      expect(PHP_MAX_LINES_CLASS_CODE).toMatch(/^php:/);
    });

    it("should contain max_lines in code name", () => {
      // Arrange & Act & Assert
      expect(PHP_MAX_LINES_CODE).toContain("max_lines");
      expect(PHP_MAX_LINES_CLASS_CODE).toContain("max_lines");
    });

    it("class rule should have _class suffix", () => {
      // Arrange & Act & Assert
      expect(PHP_MAX_LINES_CLASS_CODE).toContain("_class");
    });
  });

  describe("Rule Type Consistency", () => {
    it("both rules should have max_lines type", () => {
      // Arrange & Act
      const rule1 = createMaxLinesRule();
      const rule2 = createMaxLinesClassRule();

      // Assert
      expect(rule1.type).toBe("max_lines");
      expect(rule2.type).toBe("max_lines");
    });
  });

  describe("Thresholds", () => {
    it("should have reasonable line count limits", () => {
      // Arrange & Act
      const functionRule = createMaxLinesRule();
      const classRule = createMaxLinesClassRule();

      // Assert
      expect(functionRule.defaultConfig.max).toBeGreaterThan(0);
      expect(functionRule.defaultConfig.max).toBeLessThan(100);
      expect(classRule.defaultConfig.max).toBeGreaterThan(100);
      expect(classRule.defaultConfig.max).toBeLessThan(500);
    });
  });
});
