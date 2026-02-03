/**
 * Tests for Language Guard Manager
 */

import {
  expandLanguageGuardConfig,
  expandAllLanguageGuards,
  filterViolationsByIgnorePaths,
  processCustomRules,
  customViolationsToArchViolations,
  buildLanguageGuardResult,
  getSupportedLanguages,
  getAvailableRuleCodesForLanguage,
  hasRuleForLanguage,
  getRuleByCodeForLanguage,
} from "../languageGuardManager.js";

import type {
  ArchGuardConfig,
  LanguageGuardConfig,
  LanguageGuardCustomRule,
} from "../types/languageGuards.js";
import type { ArchViolation } from "../archGuard.js";

import {
  PHP_LAYER_BOUNDARY_CODE,
  PHP_NAMING_CLASS_CODE,
  PHP_MAX_COMPLEXITY_CODE,
} from "../guards/php/rules/index.js";

describe("Language Guard Manager", () => {
  describe("expandLanguageGuardConfig", () => {
    it("expands all PHP rules when rules array is empty", () => {
      const config: LanguageGuardConfig = {
        language: "php",
      };

      const rules = expandLanguageGuardConfig(config);
      expect(rules.length).toBeGreaterThan(0);
    });

    it("expands only specified rules (whitelist)", () => {
      const config: LanguageGuardConfig = {
        language: "php",
        rules: [PHP_LAYER_BOUNDARY_CODE, PHP_NAMING_CLASS_CODE],
      };

      const rules = expandLanguageGuardConfig(config);
      expect(rules).toHaveLength(2);
      expect(rules.map((r) => r.name)).toContain("domain-no-infrastructure");
      expect(rules.map((r) => r.name)).toContain("class-pascal-case");
    });

    it("excludes rules in excludeRules", () => {
      const config: LanguageGuardConfig = {
        language: "php",
        rules: [PHP_LAYER_BOUNDARY_CODE, PHP_NAMING_CLASS_CODE, PHP_MAX_COMPLEXITY_CODE],
        excludeRules: [PHP_MAX_COMPLEXITY_CODE],
      };

      const rules = expandLanguageGuardConfig(config);
      expect(rules).toHaveLength(2);
      expect(rules.map((r) => r.name)).not.toContain("max-cyclomatic-complexity");
    });

    it("applies overrideRules to change severity", () => {
      const config: LanguageGuardConfig = {
        language: "php",
        rules: [PHP_LAYER_BOUNDARY_CODE],
        overrideRules: [{ code: PHP_LAYER_BOUNDARY_CODE, severity: "warning" }],
      };

      const rules = expandLanguageGuardConfig(config);
      expect(rules).toHaveLength(1);
      expect(rules[0].severity).toBe("warning");
    });

    it("applies overrideRules to change config", () => {
      const config: LanguageGuardConfig = {
        language: "php",
        rules: [PHP_MAX_COMPLEXITY_CODE],
        overrideRules: [{ code: PHP_MAX_COMPLEXITY_CODE, config: { max: 20 } }],
      };

      const rules = expandLanguageGuardConfig(config);
      expect(rules).toHaveLength(1);
      expect(rules[0].config.max).toBe(20);
    });

    it("returns empty array for unsupported language", () => {
      const config: LanguageGuardConfig = {
        language: "rust", // Not yet implemented
      };

      const rules = expandLanguageGuardConfig(config);
      expect(rules).toHaveLength(0);
    });
  });

  describe("expandAllLanguageGuards", () => {
    it("expands rules from multiple languages", () => {
      const config: ArchGuardConfig = {
        languages: [
          { language: "php", rules: [PHP_LAYER_BOUNDARY_CODE] },
          { language: "typescript" }, // No TS rules implemented yet
        ],
      };

      const rules = expandAllLanguageGuards(config);
      expect(rules.length).toBeGreaterThan(0);
    });

    it("returns empty array when no languages configured", () => {
      const config: ArchGuardConfig = {};
      const rules = expandAllLanguageGuards(config);
      expect(rules).toHaveLength(0);
    });
  });

  describe("filterViolationsByIgnorePaths", () => {
    const violations: ArchViolation[] = [
      { rule: "test", file: "src/Domain/Order.php", message: "msg1", severity: "error" },
      { rule: "test", file: "src/legacy/Old.php", message: "msg2", severity: "error" },
      { rule: "test", file: "src/vendor/lib/File.php", message: "msg3", severity: "error" },
      { rule: "test", file: "src/app.ts", message: "msg4", severity: "error" },
    ];

    it("filters PHP violations by ignorePaths", () => {
      const config: ArchGuardConfig = {
        languages: [
          {
            language: "php",
            ignorePaths: ["**/legacy/**", "**/vendor/**"],
          },
        ],
      };

      const filtered = filterViolationsByIgnorePaths(violations, config);
      expect(filtered).toHaveLength(2);
      expect(filtered.map((v) => v.file)).toContain("src/Domain/Order.php");
      expect(filtered.map((v) => v.file)).toContain("src/app.ts");
    });

    it("does not filter when no ignorePaths configured", () => {
      const config: ArchGuardConfig = {
        languages: [{ language: "php" }],
      };

      const filtered = filterViolationsByIgnorePaths(violations, config);
      expect(filtered).toHaveLength(violations.length);
    });

    it("keeps violations from languages without ignorePaths", () => {
      const config: ArchGuardConfig = {
        languages: [
          { language: "php", ignorePaths: ["**/legacy/**"] },
          // No typescript config
        ],
      };

      const filtered = filterViolationsByIgnorePaths(violations, config);
      expect(filtered.map((v) => v.file)).toContain("src/app.ts");
    });
  });

  describe("processCustomRules", () => {
    it("processes custom rules and returns violations", () => {
      const customRules: LanguageGuardCustomRule[] = [
        {
          language: ["php"],
          code: "custom:no_todo",
          description: "No TODO comments",
          severity: "warning",
          check: (content: string) => {
            const matches = content.match(/TODO:/g);
            return matches ? matches.length : 0;
          },
        },
      ];

      const files = new Map<string, string>([
        ["src/Order.php", "<?php // TODO: fix this\n// TODO: another"],
        ["src/Clean.php", "<?php // No todos here"],
      ]);

      const violations = processCustomRules(customRules, files);
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe("custom:no_todo");
      expect(violations[0].file).toBe("src/Order.php");
      expect(violations[0].count).toBe(2);
    });

    it("respects custom rule ignorePaths", () => {
      const customRules: LanguageGuardCustomRule[] = [
        {
          language: ["php"],
          code: "custom:no_todo",
          description: "No TODO comments",
          severity: "warning",
          check: (content: string) => (content.match(/TODO:/g) || []).length,
          ignorePaths: ["**/legacy/**"],
        },
      ];

      const files = new Map<string, string>([
        ["src/Order.php", "<?php // TODO: fix"],
        ["src/legacy/Old.php", "<?php // TODO: old code"],
      ]);

      const violations = processCustomRules(customRules, files);
      expect(violations).toHaveLength(1);
      expect(violations[0].file).toBe("src/Order.php");
    });

    it("only processes files matching rule languages", () => {
      const customRules: LanguageGuardCustomRule[] = [
        {
          language: ["php"],
          code: "custom:no_todo",
          description: "No TODO comments",
          severity: "warning",
          check: (content: string) => (content.match(/TODO:/g) || []).length,
        },
      ];

      const files = new Map<string, string>([
        ["src/Order.php", "<?php // TODO: fix"],
        ["src/app.ts", "// TODO: typescript todo"],
      ]);

      const violations = processCustomRules(customRules, files);
      expect(violations).toHaveLength(1);
      expect(violations[0].file).toBe("src/Order.php");
    });

    it("skips rules without check function", () => {
      const customRules = [
        {
          language: ["php"] as const,
          code: "custom:broken",
          description: "Broken rule",
          severity: "warning" as const,
          check: null, // Invalid
        },
      ] as unknown as LanguageGuardCustomRule[];

      const files = new Map<string, string>([["src/Order.php", "<?php"]]);

      const violations = processCustomRules(customRules, files);
      expect(violations).toHaveLength(0);
    });
  });

  describe("customViolationsToArchViolations", () => {
    it("converts custom violations to arch violations", () => {
      const customViolations = [
        {
          rule: "custom:no_todo",
          file: "src/Order.php",
          message: "No TODO comments",
          severity: "warning" as const,
          count: 3,
        },
      ];

      const archViolations = customViolationsToArchViolations(customViolations);
      expect(archViolations).toHaveLength(1);
      expect(archViolations[0].rule).toBe("custom:no_todo");
      expect(archViolations[0].message).toContain("3 occurrences");
    });

    it("converts minor severity to warning", () => {
      const customViolations = [
        {
          rule: "custom:test",
          file: "src/test.php",
          message: "Test",
          severity: "minor" as const,
          count: 1,
        },
      ];

      const archViolations = customViolationsToArchViolations(customViolations);
      expect(archViolations[0].severity).toBe("warning");
    });
  });

  describe("buildLanguageGuardResult", () => {
    it("builds result with rules and filter function", () => {
      const config: ArchGuardConfig = {
        languages: [{ language: "php", rules: [PHP_LAYER_BOUNDARY_CODE] }],
      };

      const result = buildLanguageGuardResult(config);
      expect(result.rules.length).toBeGreaterThan(0);
      expect(typeof result.filterViolations).toBe("function");
      expect(Array.isArray(result.customRules)).toBe(true);
    });

    it("includes custom rules in result", () => {
      const config: ArchGuardConfig = {
        languages: [{ language: "php" }],
        customRules: [
          {
            language: ["php"],
            code: "custom:test",
            description: "Test",
            severity: "warning",
            check: () => 0,
          },
        ],
      };

      const result = buildLanguageGuardResult(config);
      expect(result.customRules).toHaveLength(1);
    });
  });

  describe("getSupportedLanguages", () => {
    it("returns list of supported languages", () => {
      const languages = getSupportedLanguages();
      expect(languages).toContain("php");
      expect(languages).toContain("typescript");
      expect(languages).toContain("javascript");
    });
  });

  describe("getAvailableRuleCodesForLanguage", () => {
    it("returns PHP rule codes", () => {
      const codes = getAvailableRuleCodesForLanguage("php");
      expect(codes.length).toBeGreaterThan(0);
      expect(codes).toContain(PHP_LAYER_BOUNDARY_CODE);
    });

    it("returns empty array for unsupported language", () => {
      const codes = getAvailableRuleCodesForLanguage("rust");
      expect(codes).toHaveLength(0);
    });
  });

  describe("hasRuleForLanguage", () => {
    it("returns true for existing PHP rule", () => {
      expect(hasRuleForLanguage("php", PHP_LAYER_BOUNDARY_CODE)).toBe(true);
    });

    it("returns false for non-existing rule", () => {
      expect(hasRuleForLanguage("php", "invalid:rule")).toBe(false);
    });

    it("returns false for unsupported language", () => {
      expect(hasRuleForLanguage("rust", "any:rule")).toBe(false);
    });
  });

  describe("getRuleByCodeForLanguage", () => {
    it("returns PHP rule by code", () => {
      const rule = getRuleByCodeForLanguage("php", PHP_LAYER_BOUNDARY_CODE);
      expect(rule).toBeDefined();
      expect(rule?.code).toBe(PHP_LAYER_BOUNDARY_CODE);
    });

    it("returns undefined for invalid code", () => {
      const rule = getRuleByCodeForLanguage("php", "invalid:rule");
      expect(rule).toBeUndefined();
    });

    it("returns undefined for unsupported language", () => {
      const rule = getRuleByCodeForLanguage("rust", "any:rule");
      expect(rule).toBeUndefined();
    });
  });
});
