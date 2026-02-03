/**
 * PHP Max Lines Rule
 * Limits the number of lines in functions, methods, and classes.
 */

import type { LanguageRule } from "../../../types/languageGuards.js";

export const PHP_MAX_LINES_CODE = "php:max_lines";

export function createMaxLinesRule(): LanguageRule {
  return {
    code: PHP_MAX_LINES_CODE,
    name: "max-lines",
    description: "Functions and methods should not exceed line count",
    type: "max_lines",
    severity: "warning",
    languages: ["php"],
    defaultConfig: {
      max: 50,
    },
  };
}

export const PHP_MAX_LINES_CLASS_CODE = "php:max_lines_class";

export function createMaxLinesClassRule(): LanguageRule {
  return {
    code: PHP_MAX_LINES_CLASS_CODE,
    name: "max-lines-class",
    description: "Classes should not exceed line count (consider splitting)",
    type: "max_lines",
    severity: "warning",
    languages: ["php"],
    defaultConfig: {
      max: 300,
      kind: "class",
    },
  };
}
