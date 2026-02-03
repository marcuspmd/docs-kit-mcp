/**
 * PHP Max Complexity Rule
 * Limits cyclomatic complexity of functions and methods.
 */

import type { LanguageRule } from "../../../types/languageGuards.js";

export const PHP_MAX_COMPLEXITY_CODE = "php:max_complexity";

export function createMaxComplexityRule(): LanguageRule {
  return {
    code: PHP_MAX_COMPLEXITY_CODE,
    name: "max-cyclomatic-complexity",
    description: "Functions and methods should not exceed cyclomatic complexity threshold",
    type: "max_complexity",
    severity: "warning",
    languages: ["php"],
    defaultConfig: {
      max: 10,
    },
  };
}

export const PHP_MAX_COMPLEXITY_STRICT_CODE = "php:max_complexity_strict";

export function createMaxComplexityStrictRule(): LanguageRule {
  return {
    code: PHP_MAX_COMPLEXITY_STRICT_CODE,
    name: "max-cyclomatic-complexity-strict",
    description: "Strict complexity limit for critical code paths",
    type: "max_complexity",
    severity: "error",
    languages: ["php"],
    defaultConfig: {
      max: 5,
    },
  };
}
