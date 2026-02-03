/**
 * Tests for PHP Missing Return Type Rules
 */

import {
  PHP_MISSING_RETURN_TYPE_CODE,
  createMissingReturnTypeRule,
  PHP_MISSING_RETURN_TYPE_STRICT_CODE,
  createMissingReturnTypeStrictRule,
} from "../missingReturnType.js";

describe("PHP Missing Return Type Rules", () => {
  describe("createMissingReturnTypeRule", () => {
    it("should create rule with correct properties", () => {
      // Arrange & Act
      const rule = createMissingReturnTypeRule();

      // Assert
      expect(rule.code).toBe(PHP_MISSING_RETURN_TYPE_CODE);
      expect(rule.name).toBe("require-return-type");
      expect(rule.description).toBe("Public functions and methods should declare return type");
      expect(rule.type).toBe("missing_return_type");
      expect(rule.severity).toBe("warning");
      expect(rule.languages).toEqual(["php"]);
    });

    it("should apply to public scope only", () => {
      // Arrange & Act
      const rule = createMissingReturnTypeRule();

      // Assert
      expect(rule.defaultConfig.scope).toBe("public");
    });

    it("should have warning severity", () => {
      // Arrange & Act
      const rule = createMissingReturnTypeRule();

      // Assert
      expect(rule.severity).toBe("warning");
    });

    it("should apply to PHP language", () => {
      // Arrange & Act
      const rule = createMissingReturnTypeRule();

      // Assert
      expect(rule.languages).toContain("php");
      expect(rule.languages).toHaveLength(1);
    });

    it("should mention public in description", () => {
      // Arrange & Act
      const rule = createMissingReturnTypeRule();

      // Assert
      expect(rule.description.toLowerCase()).toContain("public");
    });
  });

  describe("createMissingReturnTypeStrictRule", () => {
    it("should create rule with correct properties", () => {
      // Arrange & Act
      const rule = createMissingReturnTypeStrictRule();

      // Assert
      expect(rule.code).toBe(PHP_MISSING_RETURN_TYPE_STRICT_CODE);
      expect(rule.name).toBe("require-return-type-strict");
      expect(rule.description).toBe("All functions and methods should declare return type");
      expect(rule.type).toBe("missing_return_type");
      expect(rule.severity).toBe("error");
      expect(rule.languages).toEqual(["php"]);
    });

    it("should apply to all scope (public, private, protected)", () => {
      // Arrange & Act
      const rule = createMissingReturnTypeStrictRule();

      // Assert
      expect(rule.defaultConfig.scope).toBe("all");
    });

    it("should have error severity for strict mode", () => {
      // Arrange & Act
      const rule = createMissingReturnTypeStrictRule();

      // Assert
      expect(rule.severity).toBe("error");
    });

    it("should mention all in description", () => {
      // Arrange & Act
      const rule = createMissingReturnTypeStrictRule();

      // Assert
      expect(rule.description.toLowerCase()).toContain("all");
    });

    it("should have broader scope than regular rule", () => {
      // Arrange & Act
      const regularRule = createMissingReturnTypeRule();
      const strictRule = createMissingReturnTypeStrictRule();

      // Assert
      expect(regularRule.defaultConfig.scope).toBe("public");
      expect(strictRule.defaultConfig.scope).toBe("all");
    });
  });

  describe("Rule Codes", () => {
    it("should have unique codes for each rule", () => {
      // Arrange & Act
      const codes = [PHP_MISSING_RETURN_TYPE_CODE, PHP_MISSING_RETURN_TYPE_STRICT_CODE];

      // Assert
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);
    });

    it("should follow php namespace convention", () => {
      // Arrange & Act & Assert
      expect(PHP_MISSING_RETURN_TYPE_CODE).toMatch(/^php:/);
      expect(PHP_MISSING_RETURN_TYPE_STRICT_CODE).toMatch(/^php:/);
    });

    it("should contain missing_return_type in code name", () => {
      // Arrange & Act & Assert
      expect(PHP_MISSING_RETURN_TYPE_CODE).toContain("missing_return_type");
      expect(PHP_MISSING_RETURN_TYPE_STRICT_CODE).toContain("missing_return_type");
    });

    it("strict rule should have _strict suffix", () => {
      // Arrange & Act & Assert
      expect(PHP_MISSING_RETURN_TYPE_STRICT_CODE).toContain("_strict");
    });
  });

  describe("Rule Type Consistency", () => {
    it("both rules should have missing_return_type type", () => {
      // Arrange & Act
      const rule1 = createMissingReturnTypeRule();
      const rule2 = createMissingReturnTypeStrictRule();

      // Assert
      expect(rule1.type).toBe("missing_return_type");
      expect(rule2.type).toBe("missing_return_type");
    });
  });

  describe("Severity Progression", () => {
    it("should progress from warning to error in strict mode", () => {
      // Arrange & Act
      const regularRule = createMissingReturnTypeRule();
      const strictRule = createMissingReturnTypeStrictRule();

      // Assert
      expect(regularRule.severity).toBe("warning");
      expect(strictRule.severity).toBe("error");
    });
  });

  describe("Scope Coverage", () => {
    it("should have valid scope values", () => {
      // Arrange & Act
      const regularRule = createMissingReturnTypeRule();
      const strictRule = createMissingReturnTypeStrictRule();

      // Assert
      expect(["public", "private", "protected", "all"]).toContain(regularRule.defaultConfig.scope);
      expect(["public", "private", "protected", "all"]).toContain(strictRule.defaultConfig.scope);
    });
  });
});
