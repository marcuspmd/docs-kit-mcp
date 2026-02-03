/**
 * TypeScript Rules Index
 * Exports all TypeScript-specific architecture guard rules.
 */

// Naming Convention Rules
export {
  TS_NAMING_CLASS_CODE,
  createNamingClassRule,
  TS_NAMING_INTERFACE_CODE,
  createNamingInterfaceRule,
  TS_NAMING_TYPE_CODE,
  createNamingTypeRule,
  TS_NAMING_METHOD_CODE,
  createNamingMethodRule,
  TS_NAMING_FUNCTION_CODE,
  createNamingFunctionRule,
  TS_NAMING_CONSTANT_CODE,
  createNamingConstantRule,
  TS_NAMING_VARIABLE_CODE,
  createNamingVariableRule,
} from "./namingConvention.js";

// Layer Boundary Rules
export {
  TS_LAYER_BOUNDARY_CODE,
  createLayerBoundaryRule,
  TS_LAYER_BOUNDARY_STRICT_CODE,
  createLayerBoundaryStrictRule,
} from "./layerBoundary.js";

// Forbidden Import Rules
export {
  TS_FORBIDDEN_IMPORT_INTERNAL_CODE,
  createForbiddenImportInternalRule,
  TS_FORBIDDEN_IMPORT_BARREL_CODE,
  createForbiddenImportBarrelRule,
  TS_FORBIDDEN_IMPORT_EXTERNAL_CODE,
  createForbiddenImportExternalRule,
} from "./forbiddenImport.js";

// Max Complexity Rules
export {
  TS_MAX_COMPLEXITY_CODE,
  createMaxComplexityRule,
  TS_MAX_COMPLEXITY_STRICT_CODE,
  createMaxComplexityStrictRule,
} from "./maxComplexity.js";

// Max Parameters Rules
export {
  TS_MAX_PARAMETERS_CODE,
  createMaxParametersRule,
  TS_MAX_PARAMETERS_STRICT_CODE,
  createMaxParametersStrictRule,
} from "./maxParameters.js";

// Max Lines Rules
export {
  TS_MAX_LINES_CODE,
  createMaxLinesRule,
  TS_MAX_LINES_CLASS_CODE,
  createMaxLinesClassRule,
} from "./maxLines.js";

// Missing Return Type Rules
export {
  TS_MISSING_RETURN_TYPE_CODE,
  createMissingReturnTypeRule,
  TS_MISSING_RETURN_TYPE_STRICT_CODE,
  createMissingReturnTypeStrictRule,
} from "./missingReturnType.js";

import type { LanguageRule } from "../../../types/languageGuards.js";

import {
  createNamingClassRule,
  createNamingInterfaceRule,
  createNamingTypeRule,
  createNamingMethodRule,
  createNamingFunctionRule,
  createNamingConstantRule,
  createNamingVariableRule,
} from "./namingConvention.js";
import { createLayerBoundaryRule, createLayerBoundaryStrictRule } from "./layerBoundary.js";
import {
  createForbiddenImportInternalRule,
  createForbiddenImportBarrelRule,
  createForbiddenImportExternalRule,
} from "./forbiddenImport.js";
import { createMaxComplexityRule, createMaxComplexityStrictRule } from "./maxComplexity.js";
import { createMaxParametersRule, createMaxParametersStrictRule } from "./maxParameters.js";
import { createMaxLinesRule, createMaxLinesClassRule } from "./maxLines.js";
import {
  createMissingReturnTypeRule,
  createMissingReturnTypeStrictRule,
} from "./missingReturnType.js";

/**
 * Get all available TypeScript rules.
 */
export function getAllTypeScriptRules(): LanguageRule[] {
  return [
    // Naming Convention
    createNamingClassRule(),
    createNamingInterfaceRule(),
    createNamingTypeRule(),
    createNamingMethodRule(),
    createNamingFunctionRule(),
    createNamingConstantRule(),
    createNamingVariableRule(),
    // Layer Boundary
    createLayerBoundaryRule(),
    createLayerBoundaryStrictRule(),
    // Forbidden Import
    createForbiddenImportInternalRule(),
    createForbiddenImportBarrelRule(),
    createForbiddenImportExternalRule(),
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
export const TS_RULE_FACTORIES: Record<string, () => LanguageRule> = {
  "typescript:naming_class": createNamingClassRule,
  "typescript:naming_interface": createNamingInterfaceRule,
  "typescript:naming_type": createNamingTypeRule,
  "typescript:naming_method": createNamingMethodRule,
  "typescript:naming_function": createNamingFunctionRule,
  "typescript:naming_constant": createNamingConstantRule,
  "typescript:naming_variable": createNamingVariableRule,
  "typescript:layer_boundary": createLayerBoundaryRule,
  "typescript:layer_boundary_strict": createLayerBoundaryStrictRule,
  "typescript:forbidden_import_internal": createForbiddenImportInternalRule,
  "typescript:forbidden_import_barrel": createForbiddenImportBarrelRule,
  "typescript:forbidden_import_external": createForbiddenImportExternalRule,
  "typescript:max_complexity": createMaxComplexityRule,
  "typescript:max_complexity_strict": createMaxComplexityStrictRule,
  "typescript:max_parameters": createMaxParametersRule,
  "typescript:max_parameters_strict": createMaxParametersStrictRule,
  "typescript:max_lines": createMaxLinesRule,
  "typescript:max_lines_class": createMaxLinesClassRule,
  "typescript:missing_return_type": createMissingReturnTypeRule,
  "typescript:missing_return_type_strict": createMissingReturnTypeStrictRule,
};

/**
 * Get all available TypeScript rule codes.
 */
export function getAllTypeScriptRuleCodes(): string[] {
  return Object.keys(TS_RULE_FACTORIES);
}
