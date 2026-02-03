/**
 * Tests for PHP Max Complexity Rules
 */

import {
  PHP_MAX_COMPLEXITY_CODE,
  createMaxComplexityRule,
  PHP_MAX_COMPLEXITY_STRICT_CODE,
  createMaxComplexityStrictRule,
} from "../maxComplexity.js";

describe("PHP Max Complexity Rules", () => {
  describe("createMaxComplexityRule", () => {
    it("should create rule with correct properties", () => {
      // Arrange & Act
      const rule = createMaxComplexityRule();

      // Assert
      expect(rule.code).toBe(PHP_MAX_COMPLEXITY_CODE);
      expect(rule.name).toBe("max-cyclomatic-complexity");
      expect(rule.description).toBe(
        "Functions and methods should not exceed cyclomatic complexity threshold",
      );
      expect(rule.type).toBe("max_complexity");
      expect(rule.severity).toBe("warning");
      expect(rule.languages).toEqual(["php"]);
    });

    it("should have default max complexity of 10", () => {
      // Arrange & Act
      const rule = createMaxComplexityRule();

      // Assert
      expect(rule.defaultConfig.max).toBe(10);
    });

    it("should have warning severity", () => {
      // Arrange & Act
      const rule = createMaxComplexityRule();

      // Assert
      expect(rule.severity).toBe("warning");
    });

    it("should apply to PHP language", () => {
      // Arrange & Act
      const rule = createMaxComplexityRule();

      // Assert
      expect(rule.languages).toContain("php");
      expect(rule.languages).toHaveLength(1);
    });
  });

  describe("createMaxComplexityStrictRule", () => {
    it("should create rule with correct properties", () => {
      // Arrange & Act
      const rule = createMaxComplexityStrictRule();

      // Assert
      expect(rule.code).toBe(PHP_MAX_COMPLEXITY_STRICT_CODE);
      expect(rule.name).toBe("max-cyclomatic-complexity-strict");
      expect(rule.description).toBe("Strict complexity limit for critical code paths");
      expect(rule.type).toBe("max_complexity");
      expect(rule.severity).toBe("error");
      expect(rule.languages).toEqual(["php"]);
    });

    it("should have strict max complexity of 5", () => {
      // Arrange & Act
      const rule = createMaxComplexityStrictRule();

      // Assert
      expect(rule.defaultConfig.max).toBe(5);
    });

    it("should have error severity for strict mode", () => {
      // Arrange & Act
      const rule = createMaxComplexityStrictRule();

      // Assert
      expect(rule.severity).toBe("error");
    });

    it("should have lower threshold than regular rule", () => {
      // Arrange & Act
      const regularRule = createMaxComplexityRule();
      const strictRule = createMaxComplexityStrictRule();

      // Assert
      expect(strictRule.defaultConfig.max as number).toBeLessThan(
        regularRule.defaultConfig.max as number,
      );
    });
  });

  describe("Rule Codes", () => {
    it("should have unique codes for each rule", () => {
      // Arrange & Act
      const codes = [PHP_MAX_COMPLEXITY_CODE, PHP_MAX_COMPLEXITY_STRICT_CODE];

      // Assert
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);
    });

    it("should follow php namespace convention", () => {
      // Arrange & Act & Assert
      expect(PHP_MAX_COMPLEXITY_CODE).toMatch(/^php:/);
      expect(PHP_MAX_COMPLEXITY_STRICT_CODE).toMatch(/^php:/);
    });

    it("should contain max_complexity in code name", () => {
      // Arrange & Act & Assert
      expect(PHP_MAX_COMPLEXITY_CODE).toContain("max_complexity");
      expect(PHP_MAX_COMPLEXITY_STRICT_CODE).toContain("max_complexity");
    });

    it("strict rule should have _strict suffix", () => {
      // Arrange & Act & Assert
      expect(PHP_MAX_COMPLEXITY_STRICT_CODE).toContain("_strict");
    });
  });

  describe("Rule Type Consistency", () => {
    it("both rules should have max_complexity type", () => {
      // Arrange & Act
      const rule1 = createMaxComplexityRule();
      const rule2 = createMaxComplexityStrictRule();

      // Assert
      expect(rule1.type).toBe("max_complexity");
      expect(rule2.type).toBe("max_complexity");
    });
  });

  describe("Severity Progression", () => {
    it("should progress from warning to error in strict mode", () => {
      // Arrange & Act
      const regularRule = createMaxComplexityRule();
      const strictRule = createMaxComplexityStrictRule();

      // Assert
      expect(regularRule.severity).toBe("warning");
      expect(strictRule.severity).toBe("error");
    });
  });
});
