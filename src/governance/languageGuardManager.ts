/**
 * Language Guard Manager
 * Orchestrates language-specific architecture guards, handling:
 * - Expanding language configs into ArchRules
 * - Applying overrides and excludes
 * - Filtering violations by ignorePaths
 * - Processing custom rules
 */

import type {
  ArchGuardConfig,
  LanguageGuardConfig,
  LanguageGuardCustomRule,
  LanguageRule,
  ArchRuleOverride,
  CustomRuleViolation,
} from "./types/languageGuards.js";

import type { ArchRule, ArchViolation } from "./archGuard.js";
import {
  detectLanguageFromPath,
  SUPPORTED_LANGUAGES,
  type Language,
} from "../constants/languages.js";

// Import language-specific guards
import {
  filterPHPRulesByCodes,
  toArchRule,
  hasPHPRule,
  getPHPRuleByCode,
} from "./guards/php/phpGuards.js";

import {
  filterTypeScriptRulesByCodes,
  toArchRule as tsToArchRule,
  hasTypeScriptRule,
  getTypeScriptRuleByCode,
} from "./guards/typescript/typeScriptGuards.js";

// ============================================================================
// Glob Matching Utilities
// ============================================================================

/**
 * Simple glob pattern matching.
 */
function matchGlob(pattern: string, value: string): boolean {
  if (!pattern || !value) return false;

  const regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "§§")
    .replace(/\*/g, "[^/]*")
    .replace(/§§/g, ".*");

  return new RegExp(`^${regex}$`).test(value);
}

/**
 * Check if a file path matches any of the given glob patterns.
 */
function matchAnyGlob(patterns: string[], value: string): boolean {
  return patterns.some((p) => matchGlob(p, value));
}

// ============================================================================
// Language Rule Resolution
// ============================================================================

/**
 * Get available rules for a specific language.
 * Currently supports PHP and TypeScript/JavaScript.
 */
function getAvailableRulesForLanguage(language: Language, codes?: string[]): LanguageRule[] {
  switch (language) {
    case "php":
      return filterPHPRulesByCodes(codes);
    case "typescript":
    case "javascript":
      return filterTypeScriptRulesByCodes(codes);
    case "python":
    case "java":
    case "go":
    case "rust":
      // TODO: Implement other language guards
      return [];
    default:
      return [];
  }
}

/**
 * Check if a rule code exists for a language.
 */
export function hasRuleForLanguage(language: Language, code: string): boolean {
  switch (language) {
    case "php":
      return hasPHPRule(code);
    case "typescript":
    case "javascript":
      return hasTypeScriptRule(code);
    default:
      return false;
  }
}

/**
 * Get a single rule by code for a language.
 */
export function getRuleByCodeForLanguage(
  language: Language,
  code: string,
): LanguageRule | undefined {
  switch (language) {
    case "php":
      return getPHPRuleByCode(code);
    case "typescript":
    case "javascript":
      return getTypeScriptRuleByCode(code);
    default:
      return undefined;
  }
}

// ============================================================================
// Config Expansion
// ============================================================================

/**
 * Get the toArchRule converter for a language.
 */
function getArchRuleConverter(language: Language) {
  switch (language) {
    case "php":
      return toArchRule;
    case "typescript":
    case "javascript":
      return tsToArchRule;
    default:
      return toArchRule; // Default to PHP converter
  }
}

/**
 * Apply overrides to a LanguageRule, returning a modified ArchRule.
 */
function applyOverrides(
  rule: LanguageRule,
  overrides: ArchRuleOverride[],
  language: Language,
): ArchRule {
  const override = overrides.find((o) => o.code === rule.code);
  const toArchRule = getArchRuleConverter(language);

  if (!override) {
    return toArchRule(rule);
  }

  return toArchRule(rule, override.config, override.severity as "error" | "warning" | undefined);
}

/**
 * Expand a single LanguageGuardConfig into ArchRules.
 *
 * @param config - The language guard configuration
 * @returns Array of ArchRules ready for the ArchGuard engine
 */
export function expandLanguageGuardConfig(config: LanguageGuardConfig): ArchRule[] {
  const { language, rules: rulesCodes, overrideRules = [], excludeRules = [] } = config;

  // Get available rules (all if codes not specified, otherwise filter by whitelist)
  let languageRules = getAvailableRulesForLanguage(language, rulesCodes);

  // Apply excludeRules (blacklist)
  if (excludeRules.length > 0) {
    languageRules = languageRules.filter((r) => !excludeRules.includes(r.code));
  }

  // Apply overrides and convert to ArchRules
  return languageRules.map((rule) => applyOverrides(rule, overrideRules, language));
}

/**
 * Expand all LanguageGuardConfigs from an ArchGuardConfig into ArchRules.
 *
 * @param config - The full ArchGuard configuration
 * @returns Array of all ArchRules from all language configs
 */
export function expandAllLanguageGuards(config: ArchGuardConfig): ArchRule[] {
  const { languages = [] } = config;

  const allRules: ArchRule[] = [];

  for (const langConfig of languages) {
    const rules = expandLanguageGuardConfig(langConfig);
    allRules.push(...rules);
  }

  return allRules;
}

// ============================================================================
// Violation Filtering
// ============================================================================

/**
 * Build a map of ignorePaths by language from the config.
 */
function buildIgnorePathsMap(config: ArchGuardConfig): Map<Language, string[]> {
  const map = new Map<Language, string[]>();

  for (const langConfig of config.languages ?? []) {
    if (langConfig.ignorePaths && langConfig.ignorePaths.length > 0) {
      map.set(langConfig.language, langConfig.ignorePaths);
    }
  }

  return map;
}

/**
 * Detect language from file path based on extension.
 * Uses canonical language detection from constants/languages.ts
 */
function detectLanguageFromFile(filePath: string): Language | null {
  return detectLanguageFromPath(filePath);
}

/**
 * Filter violations by ignorePaths from the ArchGuardConfig.
 * Violations in files matching ignorePaths for their language are removed.
 *
 * @param violations - Array of violations from ArchGuard.analyze()
 * @param config - The ArchGuard configuration with ignorePaths
 * @returns Filtered violations
 */
export function filterViolationsByIgnorePaths(
  violations: ArchViolation[],
  config: ArchGuardConfig,
): ArchViolation[] {
  const ignoreMap = buildIgnorePathsMap(config);

  if (ignoreMap.size === 0) {
    return violations;
  }

  return violations.filter((v) => {
    const language = detectLanguageFromFile(v.file);

    if (!language) {
      return true; // Keep violations for unknown languages
    }

    const ignorePaths = ignoreMap.get(language);

    if (!ignorePaths || ignorePaths.length === 0) {
      return true; // No ignore paths for this language
    }

    // Filter out if file matches any ignore pattern
    return !matchAnyGlob(ignorePaths, v.file);
  });
}

// ============================================================================
// Custom Rules Processing
// ============================================================================

/**
 * Process custom rules against file content.
 *
 * @param customRules - Array of custom rule definitions
 * @param files - Map of file path to file content
 * @returns Array of custom rule violations
 */
export function processCustomRules(
  customRules: LanguageGuardCustomRule[],
  files: Map<string, string>,
): CustomRuleViolation[] {
  const violations: CustomRuleViolation[] = [];

  for (const rule of customRules) {
    // Skip if check is not a function
    if (typeof rule.check !== "function") {
      continue;
    }

    for (const [filePath, content] of files) {
      // Check if file language matches rule languages
      const fileLanguage = detectLanguageFromFile(filePath);
      if (!fileLanguage || !rule.language.includes(fileLanguage)) {
        continue;
      }

      // Check if file is in ignorePaths
      if (rule.ignorePaths && matchAnyGlob(rule.ignorePaths, filePath)) {
        continue;
      }

      // Run the custom check
      try {
        const count = rule.check(content, filePath);

        if (count > 0) {
          violations.push({
            rule: rule.code,
            file: filePath,
            message: rule.description,
            severity: rule.severity,
            count,
          });
        }
      } catch (error) {
        // Log error but continue processing
        console.warn(`Custom rule ${rule.code} failed for ${filePath}:`, error);
      }
    }
  }

  return violations;
}

/**
 * Convert CustomRuleViolations to ArchViolations for unified reporting.
 */
export function customViolationsToArchViolations(
  customViolations: CustomRuleViolation[],
): ArchViolation[] {
  return customViolations.map((cv) => ({
    rule: cv.rule,
    file: cv.file,
    message: `${cv.message} (${cv.count} occurrence${cv.count > 1 ? "s" : ""})`,
    severity: cv.severity === "minor" || cv.severity === "info" ? "warning" : cv.severity,
  }));
}

// ============================================================================
// High-Level API
// ============================================================================

export interface LanguageGuardResult {
  /** ArchRules expanded from language configs */
  rules: ArchRule[];
  /** Function to filter violations by ignorePaths */
  filterViolations: (violations: ArchViolation[]) => ArchViolation[];
  /** Custom rules to process (if any) */
  customRules: LanguageGuardCustomRule[];
}

/**
 * Build a LanguageGuardResult from an ArchGuardConfig.
 * This provides everything needed to run language-specific guards.
 *
 * @param config - The ArchGuard configuration
 * @returns LanguageGuardResult with rules, filter function, and custom rules
 */
export function buildLanguageGuardResult(config: ArchGuardConfig): LanguageGuardResult {
  return {
    rules: expandAllLanguageGuards(config),
    filterViolations: (violations) => filterViolationsByIgnorePaths(violations, config),
    customRules: config.customRules ?? [],
  };
}

/**
 * Get all supported languages.
 * Re-exported from canonical source in constants/languages.ts
 */
export function getSupportedLanguages(): Language[] {
  return [...SUPPORTED_LANGUAGES];
}

/**
 * Get all available rule codes for a language.
 */
export function getAvailableRuleCodesForLanguage(language: Language): string[] {
  const rules = getAvailableRulesForLanguage(language);
  return rules.map((r) => r.code);
}
