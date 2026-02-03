/**
 * PHP Missing Return Type Rule
 * Enforces explicit return type declarations.
 */

import type { LanguageRule } from "../../../types/languageGuards.js";

export const PHP_MISSING_RETURN_TYPE_CODE = "php:missing_return_type";

export function createMissingReturnTypeRule(): LanguageRule {
  return {
    code: PHP_MISSING_RETURN_TYPE_CODE,
    name: "require-return-type",
    description: "Public functions and methods should declare return type",
    type: "missing_return_type",
    severity: "warning",
    languages: ["php"],
    defaultConfig: {
      scope: "public",
    },
  };
}

export const PHP_MISSING_RETURN_TYPE_STRICT_CODE = "php:missing_return_type_strict";

export function createMissingReturnTypeStrictRule(): LanguageRule {
  return {
    code: PHP_MISSING_RETURN_TYPE_STRICT_CODE,
    name: "require-return-type-strict",
    description: "All functions and methods should declare return type",
    type: "missing_return_type",
    severity: "error",
    languages: ["php"],
    defaultConfig: {
      scope: "all",
    },
  };
}
