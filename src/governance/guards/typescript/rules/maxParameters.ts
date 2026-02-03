/**
 * TypeScript Max Parameters Rule
 * Limits the number of parameters in functions and methods.
 */

import type { LanguageRule } from "../../../types/languageGuards.js";

export const TS_MAX_PARAMETERS_CODE = "typescript:max_parameters";

export function createMaxParametersRule(): LanguageRule {
  return {
    code: TS_MAX_PARAMETERS_CODE,
    name: "max-function-parameters",
    description: "Functions and methods should not have too many parameters",
    type: "max_parameters",
    severity: "warning",
    languages: ["typescript", "javascript"],
    defaultConfig: {
      max: 5,
    },
  };
}

export const TS_MAX_PARAMETERS_STRICT_CODE = "typescript:max_parameters_strict";

export function createMaxParametersStrictRule(): LanguageRule {
  return {
    code: TS_MAX_PARAMETERS_STRICT_CODE,
    name: "max-function-parameters-strict",
    description: "Strict limit on function and method parameters",
    type: "max_parameters",
    severity: "error",
    languages: ["typescript", "javascript"],
    defaultConfig: {
      max: 3,
    },
  };
}
