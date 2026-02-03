/**
 * PHP Layer Boundary Rule
 * Enforces architectural boundaries between layers (e.g., domain cannot depend on infrastructure).
 */

import type { LanguageRule } from "../../../types/languageGuards.js";

export const PHP_LAYER_BOUNDARY_CODE = "php:layer_boundary";

export function createLayerBoundaryRule(): LanguageRule {
  return {
    code: PHP_LAYER_BOUNDARY_CODE,
    name: "domain-no-infrastructure",
    description: "Domain layer must not depend on infrastructure layer",
    type: "layer_boundary",
    severity: "error",
    languages: ["php"],
    defaultConfig: {
      source: "src/Domain/**",
      forbidden: ["src/Infrastructure/**", "src/Infra/**"],
    },
  };
}

export const PHP_LAYER_BOUNDARY_CONTROLLERS_DB_CODE = "php:layer_boundary_controllers_db";

export function createLayerBoundaryControllersDbRule(): LanguageRule {
  return {
    code: PHP_LAYER_BOUNDARY_CONTROLLERS_DB_CODE,
    name: "controllers-no-direct-db",
    description: "Controllers must not directly access database layer",
    type: "layer_boundary",
    severity: "warning",
    languages: ["php"],
    defaultConfig: {
      source: "src/**/Controller/**",
      forbidden: ["src/**/Database/**", "src/**/Repository/**"],
    },
  };
}
