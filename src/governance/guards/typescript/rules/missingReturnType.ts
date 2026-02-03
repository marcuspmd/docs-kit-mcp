/**
 * TypeScript Missing Return Type Rule
 * Enforces explicit return type annotations on functions and methods.
 */

import type { LanguageRule } from "../../../types/languageGuards.js";

export const TS_MISSING_RETURN_TYPE_CODE = "typescript:missing_return_type";

export function createMissingReturnTypeRule(): LanguageRule {
  return {
    code: TS_MISSING_RETURN_TYPE_CODE,
    name: "require-explicit-return-type",
    description: "Functions and methods should have explicit return type annotations",
    type: "missing_return_type",
    severity: "warning",
    languages: ["typescript"],
    defaultConfig: {
      appliesTo: ["exported", "public"],
    },
  };
}

export const TS_MISSING_RETURN_TYPE_STRICT_CODE = "typescript:missing_return_type_strict";

export function createMissingReturnTypeStrictRule(): LanguageRule {
  return {
    code: TS_MISSING_RETURN_TYPE_STRICT_CODE,
    name: "require-explicit-return-type-strict",
    description: "All functions and methods must have explicit return type annotations",
    type: "missing_return_type",
    severity: "error",
    languages: ["typescript"],
    defaultConfig: {
      appliesTo: ["all"],
    },
  };
}
