/**
 * Tests for PHP Architecture Guard Rules
 */

import {
  getAllPHPRules,
  getAllPHPRuleCodes,
  filterPHPRulesByCodes,
  getPHPRuleByCode,
  hasPHPRule,
  toArchRule,
  toArchRules,
  getPHPRulesByCategory,
  PHP_RULE_CATEGORIES,
} from "../phpGuards.js";

import {
  PHP_LAYER_BOUNDARY_CODE,
  PHP_NAMING_CLASS_CODE,
  PHP_NAMING_METHOD_CODE,
  PHP_MAX_COMPLEXITY_CODE,
  PHP_MAGIC_METHODS,
} from "../rules/index.js";

describe("PHP Guards", () => {
  describe("getAllPHPRules", () => {
    it("returns all available PHP rules", () => {
      const rules = getAllPHPRules();
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.every((r) => r.languages.includes("php"))).toBe(true);
    });

    it("each rule has required properties", () => {
      const rules = getAllPHPRules();
      for (const rule of rules) {
        expect(rule.code).toBeDefined();
        expect(rule.name).toBeDefined();
        expect(rule.description).toBeDefined();
        expect(rule.type).toBeDefined();
        expect(rule.severity).toBeDefined();
        expect(rule.defaultConfig).toBeDefined();
        expect(rule.languages).toContain("php");
      }
    });
  });

  describe("getAllPHPRuleCodes", () => {
    it("returns all rule codes", () => {
      const codes = getAllPHPRuleCodes();
      expect(codes.length).toBeGreaterThan(0);
      expect(codes).toContain(PHP_LAYER_BOUNDARY_CODE);
      expect(codes).toContain(PHP_NAMING_CLASS_CODE);
      expect(codes).toContain(PHP_MAX_COMPLEXITY_CODE);
    });
  });

  describe("filterPHPRulesByCodes", () => {
    it("returns all rules when codes is empty", () => {
      const allRules = getAllPHPRules();
      const filtered = filterPHPRulesByCodes([]);
      expect(filtered).toHaveLength(allRules.length);
    });

    it("returns all rules when codes is undefined", () => {
      const allRules = getAllPHPRules();
      const filtered = filterPHPRulesByCodes(undefined);
      expect(filtered).toHaveLength(allRules.length);
    });

    it("filters by specific codes (whitelist)", () => {
      const filtered = filterPHPRulesByCodes([PHP_LAYER_BOUNDARY_CODE, PHP_NAMING_CLASS_CODE]);
      expect(filtered).toHaveLength(2);
      expect(filtered.map((r) => r.code)).toContain(PHP_LAYER_BOUNDARY_CODE);
      expect(filtered.map((r) => r.code)).toContain(PHP_NAMING_CLASS_CODE);
    });

    it("ignores invalid codes", () => {
      const filtered = filterPHPRulesByCodes(["invalid:code", PHP_LAYER_BOUNDARY_CODE]);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].code).toBe(PHP_LAYER_BOUNDARY_CODE);
    });
  });

  describe("getPHPRuleByCode", () => {
    it("returns rule by code", () => {
      const rule = getPHPRuleByCode(PHP_LAYER_BOUNDARY_CODE);
      expect(rule).toBeDefined();
      expect(rule?.code).toBe(PHP_LAYER_BOUNDARY_CODE);
    });

    it("returns undefined for invalid code", () => {
      const rule = getPHPRuleByCode("invalid:code");
      expect(rule).toBeUndefined();
    });
  });

  describe("hasPHPRule", () => {
    it("returns true for valid code", () => {
      expect(hasPHPRule(PHP_LAYER_BOUNDARY_CODE)).toBe(true);
      expect(hasPHPRule(PHP_NAMING_CLASS_CODE)).toBe(true);
    });

    it("returns false for invalid code", () => {
      expect(hasPHPRule("invalid:code")).toBe(false);
    });
  });

  describe("toArchRule", () => {
    it("converts LanguageRule to ArchRule", () => {
      const languageRule = getPHPRuleByCode(PHP_LAYER_BOUNDARY_CODE)!;
      const archRule = toArchRule(languageRule);

      expect(archRule.name).toBe(languageRule.name);
      expect(archRule.description).toBe(languageRule.description);
      expect(archRule.type).toBe(languageRule.type);
      expect(archRule.severity).toBe(languageRule.severity);
      expect(archRule.config).toEqual(languageRule.defaultConfig);
    });

    it("applies config override", () => {
      const languageRule = getPHPRuleByCode(PHP_MAX_COMPLEXITY_CODE)!;
      const archRule = toArchRule(languageRule, { max: 20 });

      expect(archRule.config.max).toBe(20);
    });

    it("applies severity override", () => {
      const languageRule = getPHPRuleByCode(PHP_MAX_COMPLEXITY_CODE)!;
      const archRule = toArchRule(languageRule, undefined, "error");

      expect(archRule.severity).toBe("error");
    });

    it("converts info severity to warning", () => {
      // Create a mock rule with info severity
      const mockRule = {
        ...getPHPRuleByCode(PHP_LAYER_BOUNDARY_CODE)!,
        severity: "info" as const,
      };
      const archRule = toArchRule(mockRule);

      expect(archRule.severity).toBe("warning");
    });
  });

  describe("toArchRules", () => {
    it("converts multiple LanguageRules to ArchRules", () => {
      const languageRules = filterPHPRulesByCodes([PHP_LAYER_BOUNDARY_CODE, PHP_NAMING_CLASS_CODE]);
      const archRules = toArchRules(languageRules);

      expect(archRules).toHaveLength(2);
      expect(archRules[0].type).toBe("layer_boundary");
      expect(archRules[1].type).toBe("naming_convention");
    });
  });

  describe("getPHPRulesByCategory", () => {
    it("returns layerBoundary rules", () => {
      const rules = getPHPRulesByCategory("layerBoundary");
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.every((r) => r.type === "layer_boundary")).toBe(true);
    });

    it("returns naming rules", () => {
      const rules = getPHPRulesByCategory("naming");
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.every((r) => r.type === "naming_convention")).toBe(true);
    });

    it("returns metrics rules", () => {
      const rules = getPHPRulesByCategory("metrics");
      expect(rules.length).toBeGreaterThan(0);
    });
  });

  describe("PHP_RULE_CATEGORIES", () => {
    it("has expected categories", () => {
      expect(PHP_RULE_CATEGORIES.layerBoundary).toBeDefined();
      expect(PHP_RULE_CATEGORIES.naming).toBeDefined();
      expect(PHP_RULE_CATEGORIES.forbiddenImport).toBeDefined();
      expect(PHP_RULE_CATEGORIES.metrics).toBeDefined();
      expect(PHP_RULE_CATEGORIES.returnType).toBeDefined();
    });
  });

  describe("PHP_MAGIC_METHODS", () => {
    it("contains __construct", () => {
      expect(PHP_MAGIC_METHODS).toContain("__construct");
    });

    it("contains __destruct", () => {
      expect(PHP_MAGIC_METHODS).toContain("__destruct");
    });

    it("contains __toString", () => {
      expect(PHP_MAGIC_METHODS).toContain("__toString");
    });
  });

  describe("PHP naming method rule", () => {
    it("includes magic methods in allowNames", () => {
      const rule = getPHPRuleByCode(PHP_NAMING_METHOD_CODE);
      expect(rule).toBeDefined();
      expect(rule?.defaultConfig.allowNames).toContain("__construct");
      expect(rule?.defaultConfig.allowNames).toContain("__destruct");
    });
  });
});
