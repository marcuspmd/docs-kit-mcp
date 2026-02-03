/**
 * TypeScript Max Lines Rule
 * Limits the number of lines in functions, methods, and classes.
 */

import type { LanguageRule } from "../../../types/languageGuards.js";

export const TS_MAX_LINES_CODE = "typescript:max_lines";

export function createMaxLinesRule(): LanguageRule {
  return {
    code: TS_MAX_LINES_CODE,
    name: "max-function-lines",
    description: "Functions and methods should not exceed line count threshold",
    type: "max_lines",
    severity: "warning",
    languages: ["typescript", "javascript"],
    defaultConfig: {
      max: 50,
    },
  };
}

export const TS_MAX_LINES_CLASS_CODE = "typescript:max_lines_class";

export function createMaxLinesClassRule(): LanguageRule {
  return {
    code: TS_MAX_LINES_CLASS_CODE,
    name: "max-class-lines",
    description: "Classes should not exceed line count threshold",
    type: "max_lines",
    severity: "warning",
    languages: ["typescript", "javascript"],
    defaultConfig: {
      max: 200,
    },
  };
}
