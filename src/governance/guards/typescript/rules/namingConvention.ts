/**
 * TypeScript Naming Convention Rules
 * Enforces naming patterns for classes, interfaces, functions, etc.
 */

import type { LanguageRule } from "../../../types/languageGuards.js";

export const TS_NAMING_CLASS_CODE = "typescript:naming_class";

export function createNamingClassRule(): LanguageRule {
  return {
    code: TS_NAMING_CLASS_CODE,
    name: "class-pascal-case",
    description: "TypeScript classes should be PascalCase",
    type: "naming_convention",
    severity: "warning",
    languages: ["typescript", "javascript"],
    defaultConfig: {
      kind: "class",
      pattern: "^[A-Z][a-zA-Z0-9]*$",
    },
  };
}

export const TS_NAMING_INTERFACE_CODE = "typescript:naming_interface";

export function createNamingInterfaceRule(): LanguageRule {
  return {
    code: TS_NAMING_INTERFACE_CODE,
    name: "interface-pascal-case",
    description: "TypeScript interfaces should be PascalCase (optionally with 'Interface' suffix)",
    type: "naming_convention",
    severity: "warning",
    languages: ["typescript"],
    defaultConfig: {
      kind: "interface",
      pattern: "^[A-Z][a-zA-Z0-9]*(Interface)?$",
    },
  };
}

export const TS_NAMING_TYPE_CODE = "typescript:naming_type";

export function createNamingTypeRule(): LanguageRule {
  return {
    code: TS_NAMING_TYPE_CODE,
    name: "type-pascal-case",
    description: "TypeScript type aliases should be PascalCase",
    type: "naming_convention",
    severity: "warning",
    languages: ["typescript"],
    defaultConfig: {
      kind: "type_alias",
      pattern: "^[A-Z][a-zA-Z0-9]*$",
    },
  };
}

export const TS_NAMING_METHOD_CODE = "typescript:naming_method";

export function createNamingMethodRule(): LanguageRule {
  return {
    code: TS_NAMING_METHOD_CODE,
    name: "method-camel-case",
    description: "TypeScript methods should be camelCase",
    type: "naming_convention",
    severity: "warning",
    languages: ["typescript", "javascript"],
    defaultConfig: {
      kind: "method",
      pattern: "^[a-z][a-zA-Z0-9]*$",
    },
  };
}

export const TS_NAMING_FUNCTION_CODE = "typescript:naming_function";

export function createNamingFunctionRule(): LanguageRule {
  return {
    code: TS_NAMING_FUNCTION_CODE,
    name: "function-camel-case",
    description: "TypeScript functions should be camelCase",
    type: "naming_convention",
    severity: "warning",
    languages: ["typescript", "javascript"],
    defaultConfig: {
      kind: "function",
      pattern: "^[a-z][a-zA-Z0-9]*$",
    },
  };
}

export const TS_NAMING_CONSTANT_CODE = "typescript:naming_constant";

export function createNamingConstantRule(): LanguageRule {
  return {
    code: TS_NAMING_CONSTANT_CODE,
    name: "constant-upper-case",
    description: "TypeScript constants should be UPPER_SNAKE_CASE",
    type: "naming_convention",
    severity: "warning",
    languages: ["typescript", "javascript"],
    defaultConfig: {
      kind: "constant",
      pattern: "^[A-Z][A-Z0-9_]*$",
    },
  };
}

export const TS_NAMING_VARIABLE_CODE = "typescript:naming_variable";

export function createNamingVariableRule(): LanguageRule {
  return {
    code: TS_NAMING_VARIABLE_CODE,
    name: "variable-camel-case",
    description: "TypeScript variables should be camelCase",
    type: "naming_convention",
    severity: "warning",
    languages: ["typescript", "javascript"],
    defaultConfig: {
      kind: "variable",
      pattern: "^[a-z][a-zA-Z0-9]*$",
    },
  };
}
