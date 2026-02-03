/**
 * Language-specific Architecture Guards types and schemas.
 * Supports per-language rules, ignore patterns, overrides, excludes, and custom rules.
 */

import { z } from "zod";
import type { ArchRuleType } from "../archGuard.js";
import { LanguageSchema, type Language } from "../../constants/languages.js";

// ============================================================================
// Severity Levels
// ============================================================================

export const SeveritySchema = z.enum(["error", "warning", "info"]);
export type Severity = z.infer<typeof SeveritySchema>;

// ============================================================================
// Base Rule Definition (used by language-specific guards)
// ============================================================================

export interface LanguageRule {
  /** Unique rule code (e.g., "php:layer_boundary", "php:naming_convention") */
  code: string;
  /** Human-readable name */
  name: string;
  /** Rule description */
  description: string;
  /** Rule type for the ArchGuard engine */
  type: ArchRuleType;
  /** Default severity */
  severity: Severity;
  /** Default configuration */
  defaultConfig: Record<string, unknown>;
  /** Languages this rule applies to */
  languages: Language[];
}

// ============================================================================
// Rule Override Configuration
// ============================================================================

export const ArchRuleOverrideSchema = z.object({
  /** Rule code to override (e.g., "php:layer_boundary") */
  code: z.string(),
  /** Override severity (optional) */
  severity: SeveritySchema.optional(),
  /** Override configuration (merged with default) */
  config: z.record(z.unknown()).optional(),
});

export type ArchRuleOverride = z.infer<typeof ArchRuleOverrideSchema>;

// ============================================================================
// Language Guard Configuration
// ============================================================================

export const LanguageGuardConfigSchema = z.object({
  /** Target language */
  language: LanguageSchema,

  /**
   * List of rule codes to apply (whitelist).
   * If empty or undefined, ALL available rules for this language are applied.
   * Example: ["php:layer_boundary", "php:naming_convention"]
   */
  rules: z.array(z.string()).optional(),

  /**
   * Glob patterns for files to ignore.
   * Violations in these files will be filtered out.
   */
  ignorePaths: z.array(z.string()).optional(),

  /**
   * Rules to override (change severity or config).
   */
  overrideRules: z.array(ArchRuleOverrideSchema).optional(),

  /**
   * Rule codes to exclude (blacklist).
   * These rules will NOT be applied even if in the whitelist or default set.
   * Example: ["php:max_complexity"]
   */
  excludeRules: z.array(z.string()).optional(),
});

export type LanguageGuardConfig = z.infer<typeof LanguageGuardConfigSchema>;

// ============================================================================
// Custom Rule Definition
// ============================================================================

/**
 * Custom rule check function signature.
 * Receives file content and returns number of violations found (0 = no violation).
 */
export type CustomRuleCheckFn = (fileContent: string, filePath: string) => number;

export const CustomRuleSeveritySchema = z.enum(["error", "warning", "info", "minor"]);
export type CustomRuleSeverity = z.infer<typeof CustomRuleSeveritySchema>;

/**
 * Custom rule definition schema (for config validation).
 * Note: The `check` function cannot be validated by Zod, so we use z.any() for it.
 */
export const LanguageGuardCustomRuleSchema = z.object({
  /** Languages this custom rule applies to */
  language: z.array(LanguageSchema),

  /** Unique rule code (e.g., "custom:no_todo_comments") */
  code: z.string(),

  /** Human-readable description */
  description: z.string(),

  /** Rule severity */
  severity: CustomRuleSeveritySchema,

  /**
   * Check function that receives file content and returns violation count.
   * Cannot be validated by Zod, validated at runtime.
   */
  check: z.any(),

  /**
   * Glob patterns for files to ignore.
   */
  ignorePaths: z.array(z.string()).optional(),
});

export type LanguageGuardCustomRule = z.infer<typeof LanguageGuardCustomRuleSchema>;

// ============================================================================
// Full ArchGuard Configuration (new structure)
// ============================================================================

export const ArchGuardConfigSchema = z.object({
  /**
   * Language-specific guard configurations.
   * Each entry defines rules, ignores, and overrides for a specific language.
   */
  languages: z.array(LanguageGuardConfigSchema).optional(),

  /**
   * Custom rules that can apply across multiple languages.
   */
  customRules: z.array(LanguageGuardCustomRuleSchema).optional(),
});

export type ArchGuardConfig = z.infer<typeof ArchGuardConfigSchema>;

// ============================================================================
// Custom Rule Violation (returned by custom rules)
// ============================================================================

export interface CustomRuleViolation {
  rule: string;
  file: string;
  message: string;
  severity: CustomRuleSeverity;
  count: number;
}

// ============================================================================
// Language Guard Registry Interface
// ============================================================================

export interface LanguageGuardRegistry {
  /** Get all available rules for a language */
  getAvailableRules(language: Language): LanguageRule[];

  /** Get rules filtered by code list (empty = all) */
  getRulesByCodes(language: Language, codes?: string[]): LanguageRule[];

  /** Check if a rule code exists for a language */
  hasRule(language: Language, code: string): boolean;
}
