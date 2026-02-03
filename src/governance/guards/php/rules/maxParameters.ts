/**
 * PHP Max Parameters Rule
 * Limits the number of parameters in functions and methods.
 */

import type { LanguageRule } from "../../../types/languageGuards.js";

export const PHP_MAX_PARAMETERS_CODE = "php:max_parameters";

export function createMaxParametersRule(): LanguageRule {
  return {
    code: PHP_MAX_PARAMETERS_CODE,
    name: "max-parameters",
    description: "Functions and methods should not have too many parameters",
    type: "max_parameters",
    severity: "warning",
    languages: ["php"],
    defaultConfig: {
      max: 5,
    },
  };
}

export const PHP_MAX_PARAMETERS_STRICT_CODE = "php:max_parameters_strict";

export function createMaxParametersStrictRule(): LanguageRule {
  return {
    code: PHP_MAX_PARAMETERS_STRICT_CODE,
    name: "max-parameters-strict",
    description: "Strict parameter limit (consider using DTOs or parameter objects)",
    type: "max_parameters",
    severity: "error",
    languages: ["php"],
    defaultConfig: {
      max: 3,
    },
  };
}
