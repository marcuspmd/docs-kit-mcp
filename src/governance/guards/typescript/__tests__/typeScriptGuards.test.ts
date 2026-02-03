/**
 * TypeScript Guards Tests
 * Validates TypeScript rule creation and configuration.
 */

import { describe, it, expect } from "@jest/globals";
import {
  getTypeScriptAvailableRules,
  getTypeScriptAvailableCodes,
  filterTypeScriptRulesByCodes,
  getTypeScriptRuleByCode,
  hasTypeScriptRule,
  getTypeScriptRulesByCategory,
  TS_RULE_CATEGORIES,
  toArchRule,
} from "../typeScriptGuards.js";

describe("TypeScript Guards", () => {
  describe("getTypeScriptAvailableRules", () => {
    it("returns all available TypeScript rules", () => {
      const rules = getTypeScriptAvailableRules();
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.every((r) => r.code.startsWith("typescript:"))).toBe(true);
    });

    it("returns rules for typescript and javascript", () => {
      const rules = getTypeScriptAvailableRules();
      const languages = new Set(rules.flatMap((r) => r.languages));
      expect(languages.has("typescript")).toBe(true);
    });
  });

  describe("getTypeScriptAvailableCodes", () => {
    it("returns all rule codes", () => {
      const codes = getTypeScriptAvailableCodes();
      expect(codes.length).toBeGreaterThan(0);
      expect(codes.every((c) => c.startsWith("typescript:"))).toBe(true);
    });

    it("includes naming rules", () => {
      const codes = getTypeScriptAvailableCodes();
      expect(codes).toContain("typescript:naming_class");
      expect(codes).toContain("typescript:naming_interface");
    });

    it("includes complexity rules", () => {
      const codes = getTypeScriptAvailableCodes();
      expect(codes).toContain("typescript:max_complexity");
      expect(codes).toContain("typescript:max_parameters");
    });
  });

  describe("filterTypeScriptRulesByCodes", () => {
    it("returns all rules when codes is empty", () => {
      const allRules = getTypeScriptAvailableRules();
      const filtered = filterTypeScriptRulesByCodes([]);
      expect(filtered.length).toBe(allRules.length);
    });

    it("filters by single code", () => {
      const filtered = filterTypeScriptRulesByCodes(["typescript:naming_class"]);
      expect(filtered.length).toBe(1);
      expect(filtered[0].code).toBe("typescript:naming_class");
    });

    it("filters by multiple codes", () => {
      const codes = ["typescript:naming_class", "typescript:naming_interface", "typescript:max_complexity"];
      const filtered = filterTypeScriptRulesByCodes(codes);
      expect(filtered.length).toBe(3);
      expect(filtered.map((r) => r.code)).toEqual(expect.arrayContaining(codes));
    });
  });

  describe("getTypeScriptRuleByCode", () => {
    it("returns rule for valid code", () => {
      const rule = getTypeScriptRuleByCode("typescript:naming_class");
      expect(rule).toBeDefined();
      expect(rule?.code).toBe("typescript:naming_class");
      expect(rule?.name).toBe("class-pascal-case");
    });

    it("returns undefined for invalid code", () => {
      const rule = getTypeScriptRuleByCode("typescript:nonexistent");
      expect(rule).toBeUndefined();
    });
  });

  describe("hasTypeScriptRule", () => {
    it("returns true for valid rules", () => {
      expect(hasTypeScriptRule("typescript:naming_class")).toBe(true);
      expect(hasTypeScriptRule("typescript:max_complexity")).toBe(true);
    });

    it("returns false for invalid rules", () => {
      expect(hasTypeScriptRule("typescript:nonexistent")).toBe(false);
      expect(hasTypeScriptRule("php:naming_class")).toBe(false);
    });
  });

  describe("TS_RULE_CATEGORIES", () => {
    it("categorizes all rules", () => {
      const allRules = getTypeScriptAvailableRules();
      const categorizedCodes = Object.values(TS_RULE_CATEGORIES).flat();
      const allCodes = allRules.map((r) => r.code);

      expect(new Set(categorizedCodes).size).toBe(allCodes.length);
    });

    it("has naming category", () => {
      expect(TS_RULE_CATEGORIES.naming).toContain("typescript:naming_class");
      expect(TS_RULE_CATEGORIES.naming).toContain("typescript:naming_interface");
    });

    it("has metrics category", () => {
      expect(TS_RULE_CATEGORIES.metrics).toContain("typescript:max_complexity");
      expect(TS_RULE_CATEGORIES.metrics).toContain("typescript:max_parameters");
    });
  });

  describe("getTypeScriptRulesByCategory", () => {
    it("returns naming rules", () => {
      const rules = getTypeScriptRulesByCategory("naming");
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.every((r) => r.type === "naming_convention")).toBe(true);
    });

    it("returns metrics rules", () => {
      const rules = getTypeScriptRulesByCategory("metrics");
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.some((r) => r.type === "max_complexity")).toBe(true);
    });

    it("returns layer boundary rules", () => {
      const rules = getTypeScriptRulesByCategory("layerBoundary");
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.every((r) => r.type === "layer_boundary")).toBe(true);
    });
  });

  describe("toArchRule", () => {
    it("converts LanguageRule to ArchRule", () => {
      const rule = getTypeScriptRuleByCode("typescript:naming_class");
      expect(rule).toBeDefined();

      const archRule = toArchRule(rule!);
      expect(archRule.name).toBe("class-pascal-case");
      expect(archRule.type).toBe("naming_convention");
      expect(archRule.severity).toBe("warning");
    });

    it("applies config override", () => {
      const rule = getTypeScriptRuleByCode("typescript:max_complexity");
      expect(rule).toBeDefined();

      const archRule = toArchRule(rule!, { max: 5 });
      expect(archRule.config).toEqual({ max: 5 });
    });

    it("applies severity override", () => {
      const rule = getTypeScriptRuleByCode("typescript:max_complexity");
      expect(rule).toBeDefined();

      const archRule = toArchRule(rule!, undefined, "error");
      expect(archRule.severity).toBe("error");
    });

    it("converts info severity to warning", () => {
      const rule = getTypeScriptRuleByCode("typescript:naming_variable");
      expect(rule).toBeDefined();

      const archRule = toArchRule(rule!);
      expect(archRule.severity).toBe("warning");
    });
  });

  describe("Rule Structure", () => {
    it("all rules have required fields", () => {
      const rules = getTypeScriptAvailableRules();

      rules.forEach((rule) => {
        expect(rule.code).toBeDefined();
        expect(rule.code).toMatch(/^typescript:/);
        expect(rule.name).toBeDefined();
        expect(rule.description).toBeDefined();
        expect(rule.type).toBeDefined();
        expect(rule.severity).toBeDefined();
        expect(rule.languages).toBeDefined();
        expect(rule.languages.length).toBeGreaterThan(0);
        expect(rule.defaultConfig).toBeDefined();
      });
    });

    it("all rules support typescript language", () => {
      const rules = getTypeScriptAvailableRules();
      expect(rules.every((r) => r.languages.includes("typescript"))).toBe(true);
    });
  });
});
