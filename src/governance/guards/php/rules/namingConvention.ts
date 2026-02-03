/**
 * PHP Naming Convention Rules
 * Enforces naming patterns for classes, methods, functions, etc.
 * Allows PHP magic methods (__construct, __destruct, etc.)
 */

import type { LanguageRule } from "../../../types/languageGuards.js";

/** PHP magic method names that are allowed as exceptions to naming rules */
export const PHP_MAGIC_METHODS = [
  "__construct",
  "__destruct",
  "__call",
  "__callStatic",
  "__get",
  "__set",
  "__isset",
  "__unset",
  "__sleep",
  "__wakeup",
  "__serialize",
  "__unserialize",
  "__toString",
  "__invoke",
  "__set_state",
  "__clone",
  "__debugInfo",
];

export const PHP_NAMING_CLASS_CODE = "php:naming_class";

export function createNamingClassRule(): LanguageRule {
  return {
    code: PHP_NAMING_CLASS_CODE,
    name: "class-pascal-case",
    description: "PHP classes should be PascalCase",
    type: "naming_convention",
    severity: "warning",
    languages: ["php"],
    defaultConfig: {
      kind: "class",
      pattern: "^[A-Z][a-zA-Z0-9]*$",
    },
  };
}

export const PHP_NAMING_INTERFACE_CODE = "php:naming_interface";

export function createNamingInterfaceRule(): LanguageRule {
  return {
    code: PHP_NAMING_INTERFACE_CODE,
    name: "interface-pascal-case",
    description: "PHP interfaces should be PascalCase (optionally with 'Interface' suffix)",
    type: "naming_convention",
    severity: "warning",
    languages: ["php"],
    defaultConfig: {
      kind: "interface",
      pattern: "^[A-Z][a-zA-Z0-9]*(Interface)?$",
    },
  };
}

export const PHP_NAMING_TRAIT_CODE = "php:naming_trait";

export function createNamingTraitRule(): LanguageRule {
  return {
    code: PHP_NAMING_TRAIT_CODE,
    name: "trait-pascal-case",
    description: "PHP traits should be PascalCase (optionally with 'Trait' suffix)",
    type: "naming_convention",
    severity: "warning",
    languages: ["php"],
    defaultConfig: {
      kind: "trait",
      pattern: "^[A-Z][a-zA-Z0-9]*(Trait)?$",
    },
  };
}

export const PHP_NAMING_METHOD_CODE = "php:naming_method";

export function createNamingMethodRule(): LanguageRule {
  return {
    code: PHP_NAMING_METHOD_CODE,
    name: "method-camel-case",
    description: "PHP methods should be camelCase (magic methods like __construct allowed)",
    type: "naming_convention",
    severity: "warning",
    languages: ["php"],
    defaultConfig: {
      kind: "method",
      pattern: "^[a-z][a-zA-Z0-9]*$",
      allowNames: PHP_MAGIC_METHODS,
    },
  };
}

export const PHP_NAMING_FUNCTION_CODE = "php:naming_function";

export function createNamingFunctionRule(): LanguageRule {
  return {
    code: PHP_NAMING_FUNCTION_CODE,
    name: "function-camel-case",
    description: "PHP functions should be camelCase or snake_case",
    type: "naming_convention",
    severity: "warning",
    languages: ["php"],
    defaultConfig: {
      kind: "function",
      pattern: "^[a-z][a-zA-Z0-9]*$|^[a-z][a-z0-9_]*$",
    },
  };
}

export const PHP_NAMING_CONSTANT_CODE = "php:naming_constant";

export function createNamingConstantRule(): LanguageRule {
  return {
    code: PHP_NAMING_CONSTANT_CODE,
    name: "constant-upper-case",
    description: "PHP class constants should be UPPER_SNAKE_CASE",
    type: "naming_convention",
    severity: "warning",
    languages: ["php"],
    defaultConfig: {
      kind: "constant",
      pattern: "^[A-Z][A-Z0-9_]*$",
    },
  };
}
