/**
 * PHP Guards Aggregator
 * Provides high-level functions for working with PHP architecture guard rules.
 */

import type { LanguageRule } from "../../types/languageGuards.js";
import type { ArchRule } from "../../archGuard.js";

import { getAllPHPRules, getAllPHPRuleCodes, PHP_RULE_FACTORIES } from "./rules/index.js";

// Re-export everything from rules for convenience
export * from "./rules/index.js";

/**
 * Get all available PHP rules.
 */
export function getPHPAvailableRules(): LanguageRule[] {
  return getAllPHPRules();
}

/**
 * Get all available PHP rule codes.
 */
export function getPHPAvailableCodes(): string[] {
  return getAllPHPRuleCodes();
}

/**
 * Get PHP rules filtered by code list.
 * If codes is empty or undefined, returns ALL available PHP rules.
 *
 * @param codes - List of rule codes to include (whitelist). Empty = all rules.
 * @returns Filtered list of PHP rules.
 */
export function filterPHPRulesByCodes(codes?: string[]): LanguageRule[] {
  const allRules = getAllPHPRules();

  // If no codes specified or empty array, return all rules
  if (!codes || codes.length === 0) {
    return allRules;
  }

  // Filter by codes (whitelist)
  return allRules.filter((rule) => codes.includes(rule.code));
}

/**
 * Get a single PHP rule by its code.
 *
 * @param code - The rule code (e.g., "php:layer_boundary")
 * @returns The rule or undefined if not found.
 */
export function getPHPRuleByCode(code: string): LanguageRule | undefined {
  const factory = PHP_RULE_FACTORIES[code];
  return factory ? factory() : undefined;
}

/**
 * Check if a rule code exists for PHP.
 */
export function hasPHPRule(code: string): boolean {
  return code in PHP_RULE_FACTORIES;
}

/**
 * Convert a LanguageRule to an ArchRule (for the ArchGuard engine).
 * Applies optional config overrides.
 *
 * @param rule - The LanguageRule to convert
 * @param configOverride - Optional config to merge with defaultConfig
 * @param severityOverride - Optional severity override
 * @returns An ArchRule compatible with the ArchGuard engine
 */
export function toArchRule(
  rule: LanguageRule,
  configOverride?: Record<string, unknown>,
  severityOverride?: "error" | "warning",
): ArchRule {
  return {
    name: rule.name,
    description: rule.description,
    type: rule.type,
    severity: severityOverride ?? (rule.severity === "info" ? "warning" : rule.severity),
    config: {
      ...rule.defaultConfig,
      ...configOverride,
    },
  };
}

/**
 * Convert multiple LanguageRules to ArchRules.
 */
export function toArchRules(rules: LanguageRule[]): ArchRule[] {
  return rules.map((r) => toArchRule(r));
}

/**
 * PHP rule categories for organizational purposes.
 */
export const PHP_RULE_CATEGORIES = {
  layerBoundary: ["php:layer_boundary", "php:layer_boundary_controllers_db"],
  naming: [
    "php:naming_class",
    "php:naming_interface",
    "php:naming_trait",
    "php:naming_method",
    "php:naming_function",
    "php:naming_constant",
  ],
  forbiddenImport: [
    "php:forbidden_import_controllers",
    "php:forbidden_import_domain",
    "php:forbidden_global_state",
  ],
  metrics: [
    "php:max_complexity",
    "php:max_complexity_strict",
    "php:max_parameters",
    "php:max_parameters_strict",
    "php:max_lines",
    "php:max_lines_class",
  ],
  returnType: ["php:missing_return_type", "php:missing_return_type_strict"],
} as const;

/**
 * Get PHP rules by category.
 */
export function getPHPRulesByCategory(category: keyof typeof PHP_RULE_CATEGORIES): LanguageRule[] {
  const codes = PHP_RULE_CATEGORIES[category];
  return filterPHPRulesByCodes([...codes]);
}
