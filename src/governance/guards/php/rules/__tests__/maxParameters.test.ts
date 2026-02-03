/**
 * Tests for PHP Max Parameters Rules
 */

import {
  PHP_MAX_PARAMETERS_CODE,
  createMaxParametersRule,
  PHP_MAX_PARAMETERS_STRICT_CODE,
  createMaxParametersStrictRule,
} from "../maxParameters.js";

describe("PHP Max Parameters Rules", () => {
  describe("createMaxParametersRule", () => {
    it("should create rule with correct properties", () => {
      // Arrange & Act
      const rule = createMaxParametersRule();

      // Assert
      expect(rule.code).toBe(PHP_MAX_PARAMETERS_CODE);
      expect(rule.name).toBe("max-parameters");
      expect(rule.description).toBe("Functions and methods should not have too many parameters");
      expect(rule.type).toBe("max_parameters");
      expect(rule.severity).toBe("warning");
      expect(rule.languages).toEqual(["php"]);
    });

    it("should have default max parameters of 5", () => {
      // Arrange & Act
      const rule = createMaxParametersRule();

      // Assert
      expect(rule.defaultConfig.max).toBe(5);
    });

    it("should have warning severity", () => {
      // Arrange & Act
      const rule = createMaxParametersRule();

      // Assert
      expect(rule.severity).toBe("warning");
    });

    it("should apply to PHP language", () => {
      // Arrange & Act
      const rule = createMaxParametersRule();

      // Assert
      expect(rule.languages).toContain("php");
      expect(rule.languages).toHaveLength(1);
    });
  });

  describe("createMaxParametersStrictRule", () => {
    it("should create rule with correct properties", () => {
      // Arrange & Act
      const rule = createMaxParametersStrictRule();

      // Assert
      expect(rule.code).toBe(PHP_MAX_PARAMETERS_STRICT_CODE);
      expect(rule.name).toBe("max-parameters-strict");
      expect(rule.description).toBe(
        "Strict parameter limit (consider using DTOs or parameter objects)",
      );
      expect(rule.type).toBe("max_parameters");
      expect(rule.severity).toBe("error");
      expect(rule.languages).toEqual(["php"]);
    });

    it("should have strict max parameters of 3", () => {
      // Arrange & Act
      const rule = createMaxParametersStrictRule();

      // Assert
      expect(rule.defaultConfig.max).toBe(3);
    });

    it("should have error severity for strict mode", () => {
      // Arrange & Act
      const rule = createMaxParametersStrictRule();

      // Assert
      expect(rule.severity).toBe("error");
    });

    it("should have lower threshold than regular rule", () => {
      // Arrange & Act
      const regularRule = createMaxParametersRule();
      const strictRule = createMaxParametersStrictRule();

      // Assert
      expect(strictRule.defaultConfig.max as number).toBeLessThan(
        regularRule.defaultConfig.max as number,
      );
    });

    it("should suggest using DTOs in description", () => {
      // Arrange & Act
      const rule = createMaxParametersStrictRule();

      // Assert
      expect(rule.description.toLowerCase()).toContain("dto");
    });
  });

  describe("Rule Codes", () => {
    it("should have unique codes for each rule", () => {
      // Arrange & Act
      const codes = [PHP_MAX_PARAMETERS_CODE, PHP_MAX_PARAMETERS_STRICT_CODE];

      // Assert
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);
    });

    it("should follow php namespace convention", () => {
      // Arrange & Act & Assert
      expect(PHP_MAX_PARAMETERS_CODE).toMatch(/^php:/);
      expect(PHP_MAX_PARAMETERS_STRICT_CODE).toMatch(/^php:/);
    });

    it("should contain max_parameters in code name", () => {
      // Arrange & Act & Assert
      expect(PHP_MAX_PARAMETERS_CODE).toContain("max_parameters");
      expect(PHP_MAX_PARAMETERS_STRICT_CODE).toContain("max_parameters");
    });

    it("strict rule should have _strict suffix", () => {
      // Arrange & Act & Assert
      expect(PHP_MAX_PARAMETERS_STRICT_CODE).toContain("_strict");
    });
  });

  describe("Rule Type Consistency", () => {
    it("both rules should have max_parameters type", () => {
      // Arrange & Act
      const rule1 = createMaxParametersRule();
      const rule2 = createMaxParametersStrictRule();

      // Assert
      expect(rule1.type).toBe("max_parameters");
      expect(rule2.type).toBe("max_parameters");
    });
  });

  describe("Severity Progression", () => {
    it("should progress from warning to error in strict mode", () => {
      // Arrange & Act
      const regularRule = createMaxParametersRule();
      const strictRule = createMaxParametersStrictRule();

      // Assert
      expect(regularRule.severity).toBe("warning");
      expect(strictRule.severity).toBe("error");
    });
  });

  describe("Parameter Limits", () => {
    it("should have reasonable parameter limits", () => {
      // Arrange & Act
      const regularRule = createMaxParametersRule();
      const strictRule = createMaxParametersStrictRule();

      // Assert
      expect(regularRule.defaultConfig.max).toBeGreaterThan(2);
      expect(regularRule.defaultConfig.max).toBeLessThan(10);
      expect(strictRule.defaultConfig.max).toBeGreaterThan(0);
      expect(strictRule.defaultConfig.max).toBeLessThan(5);
    });
  });
});
