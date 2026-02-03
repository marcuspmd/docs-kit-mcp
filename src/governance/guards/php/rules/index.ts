/**
 * PHP Rules Index
 * Exports all PHP-specific architecture guard rules.
 */

// Layer Boundary Rules
export {
  PHP_LAYER_BOUNDARY_CODE,
  createLayerBoundaryRule,
  PHP_LAYER_BOUNDARY_CONTROLLERS_DB_CODE,
  createLayerBoundaryControllersDbRule,
} from "./layerBoundary.js";

// Naming Convention Rules
export {
  PHP_MAGIC_METHODS,
  PHP_NAMING_CLASS_CODE,
  createNamingClassRule,
  PHP_NAMING_INTERFACE_CODE,
  createNamingInterfaceRule,
  PHP_NAMING_TRAIT_CODE,
  createNamingTraitRule,
  PHP_NAMING_METHOD_CODE,
  createNamingMethodRule,
  PHP_NAMING_FUNCTION_CODE,
  createNamingFunctionRule,
  PHP_NAMING_CONSTANT_CODE,
  createNamingConstantRule,
} from "./namingConvention.js";

// Forbidden Import Rules
export {
  PHP_FORBIDDEN_IMPORT_CONTROLLERS_CODE,
  createForbiddenImportControllersRule,
  PHP_FORBIDDEN_IMPORT_DOMAIN_CODE,
  createForbiddenImportDomainRule,
  PHP_FORBIDDEN_IMPORT_GLOBAL_STATE_CODE,
  createForbiddenGlobalStateRule,
} from "./forbiddenImport.js";

// Max Complexity Rules
export {
  PHP_MAX_COMPLEXITY_CODE,
  createMaxComplexityRule,
  PHP_MAX_COMPLEXITY_STRICT_CODE,
  createMaxComplexityStrictRule,
} from "./maxComplexity.js";

// Max Parameters Rules
export {
  PHP_MAX_PARAMETERS_CODE,
  createMaxParametersRule,
  PHP_MAX_PARAMETERS_STRICT_CODE,
  createMaxParametersStrictRule,
} from "./maxParameters.js";

// Max Lines Rules
export {
  PHP_MAX_LINES_CODE,
  createMaxLinesRule,
  PHP_MAX_LINES_CLASS_CODE,
  createMaxLinesClassRule,
} from "./maxLines.js";

// Missing Return Type Rules
export {
  PHP_MISSING_RETURN_TYPE_CODE,
  createMissingReturnTypeRule,
  PHP_MISSING_RETURN_TYPE_STRICT_CODE,
  createMissingReturnTypeStrictRule,
} from "./missingReturnType.js";

import type { LanguageRule } from "../../../types/languageGuards.js";

import { createLayerBoundaryRule, createLayerBoundaryControllersDbRule } from "./layerBoundary.js";
import {
  createNamingClassRule,
  createNamingInterfaceRule,
  createNamingTraitRule,
  createNamingMethodRule,
  createNamingFunctionRule,
  createNamingConstantRule,
} from "./namingConvention.js";
import {
  createForbiddenImportControllersRule,
  createForbiddenImportDomainRule,
  createForbiddenGlobalStateRule,
} from "./forbiddenImport.js";
import { createMaxComplexityRule, createMaxComplexityStrictRule } from "./maxComplexity.js";
import { createMaxParametersRule, createMaxParametersStrictRule } from "./maxParameters.js";
import { createMaxLinesRule, createMaxLinesClassRule } from "./maxLines.js";
import {
  createMissingReturnTypeRule,
  createMissingReturnTypeStrictRule,
} from "./missingReturnType.js";

/**
 * Get all available PHP rules.
 */
export function getAllPHPRules(): LanguageRule[] {
  return [
    // Layer Boundary
    createLayerBoundaryRule(),
    createLayerBoundaryControllersDbRule(),
    // Naming Convention
    createNamingClassRule(),
    createNamingInterfaceRule(),
    createNamingTraitRule(),
    createNamingMethodRule(),
    createNamingFunctionRule(),
    createNamingConstantRule(),
    // Forbidden Import
    createForbiddenImportControllersRule(),
    createForbiddenImportDomainRule(),
    createForbiddenGlobalStateRule(),
    // Max Complexity
    createMaxComplexityRule(),
    createMaxComplexityStrictRule(),
    // Max Parameters
    createMaxParametersRule(),
    createMaxParametersStrictRule(),
    // Max Lines
    createMaxLinesRule(),
    createMaxLinesClassRule(),
    // Missing Return Type
    createMissingReturnTypeRule(),
    createMissingReturnTypeStrictRule(),
  ];
}

/**
 * Map of rule code to rule factory function for quick lookup.
 */
export const PHP_RULE_FACTORIES: Record<string, () => LanguageRule> = {
  "php:layer_boundary": createLayerBoundaryRule,
  "php:layer_boundary_controllers_db": createLayerBoundaryControllersDbRule,
  "php:naming_class": createNamingClassRule,
  "php:naming_interface": createNamingInterfaceRule,
  "php:naming_trait": createNamingTraitRule,
  "php:naming_method": createNamingMethodRule,
  "php:naming_function": createNamingFunctionRule,
  "php:naming_constant": createNamingConstantRule,
  "php:forbidden_import_controllers": createForbiddenImportControllersRule,
  "php:forbidden_import_domain": createForbiddenImportDomainRule,
  "php:forbidden_global_state": createForbiddenGlobalStateRule,
  "php:max_complexity": createMaxComplexityRule,
  "php:max_complexity_strict": createMaxComplexityStrictRule,
  "php:max_parameters": createMaxParametersRule,
  "php:max_parameters_strict": createMaxParametersStrictRule,
  "php:max_lines": createMaxLinesRule,
  "php:max_lines_class": createMaxLinesClassRule,
  "php:missing_return_type": createMissingReturnTypeRule,
  "php:missing_return_type_strict": createMissingReturnTypeStrictRule,
};

/**
 * Get all available PHP rule codes.
 */
export function getAllPHPRuleCodes(): string[] {
  return Object.keys(PHP_RULE_FACTORIES);
}
