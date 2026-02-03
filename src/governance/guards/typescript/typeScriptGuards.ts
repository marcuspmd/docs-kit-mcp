/**
 * TypeScript Guards Aggregator
 * Provides high-level functions for working with TypeScript architecture guard rules.
 */

import type { LanguageRule } from "../../types/languageGuards.js";
import type { ArchRule } from "../../archGuard.js";

import {
  getAllTypeScriptRules,
  getAllTypeScriptRuleCodes,
  TS_RULE_FACTORIES,
} from "./rules/index.js";

// Re-export everything from rules for convenience
export * from "./rules/index.js";

/**
 * Get all available TypeScript rules.
 */
export function getTypeScriptAvailableRules(): LanguageRule[] {
  return getAllTypeScriptRules();
}

/**
 * Get all available TypeScript rule codes.
 */
export function getTypeScriptAvailableCodes(): string[] {
  return getAllTypeScriptRuleCodes();
}

/**
 * Get TypeScript rules filtered by code list.
 * If codes is empty or undefined, returns ALL available TypeScript rules.
 *
 * @param codes - List of rule codes to include (whitelist). Empty = all rules.
 * @returns Filtered list of TypeScript rules.
 */
export function filterTypeScriptRulesByCodes(codes?: string[]): LanguageRule[] {
  const allRules = getAllTypeScriptRules();

  // If no codes specified or empty array, return all rules
  if (!codes || codes.length === 0) {
    return allRules;
  }

  // Filter by codes (whitelist)
  return allRules.filter((rule) => codes.includes(rule.code));
}

/**
 * Get a single TypeScript rule by its code.
 *
 * @param code - The rule code (e.g., "typescript:naming_class")
 * @returns The rule or undefined if not found.
 */
export function getTypeScriptRuleByCode(code: string): LanguageRule | undefined {
  const factory = TS_RULE_FACTORIES[code];
  return factory ? factory() : undefined;
}

/**
 * Check if a rule code exists for TypeScript.
 */
export function hasTypeScriptRule(code: string): boolean {
  return code in TS_RULE_FACTORIES;
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
 * TypeScript rule categories for organizational purposes.
 */
export const TS_RULE_CATEGORIES = {
  naming: [
    "typescript:naming_class",
    "typescript:naming_interface",
    "typescript:naming_type",
    "typescript:naming_method",
    "typescript:naming_function",
    "typescript:naming_constant",
    "typescript:naming_variable",
  ],
  layerBoundary: ["typescript:layer_boundary", "typescript:layer_boundary_strict"],
  forbiddenImport: [
    "typescript:forbidden_import_internal",
    "typescript:forbidden_import_barrel",
    "typescript:forbidden_import_external",
  ],
  metrics: [
    "typescript:max_complexity",
    "typescript:max_complexity_strict",
    "typescript:max_parameters",
    "typescript:max_parameters_strict",
    "typescript:max_lines",
    "typescript:max_lines_class",
  ],
  returnType: ["typescript:missing_return_type", "typescript:missing_return_type_strict"],
} as const;

/**
 * Get TypeScript rules by category.
 */
export function getTypeScriptRulesByCategory(
  category: keyof typeof TS_RULE_CATEGORIES,
): LanguageRule[] {
  const codes = TS_RULE_CATEGORIES[category];
  return filterTypeScriptRulesByCodes([...codes]);
}
