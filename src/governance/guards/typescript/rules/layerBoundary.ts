/**
 * TypeScript Layer Boundary Rules
 * Enforces architectural layer separation (e.g., controllers, services, domain).
 */

import type { LanguageRule } from "../../../types/languageGuards.js";

export const TS_LAYER_BOUNDARY_CODE = "typescript:layer_boundary";

export function createLayerBoundaryRule(): LanguageRule {
  return {
    code: TS_LAYER_BOUNDARY_CODE,
    name: "layer-boundary",
    description: "Enforces separation between architectural layers",
    type: "layer_boundary",
    severity: "error",
    languages: ["typescript", "javascript"],
    defaultConfig: {
      layers: [
        {
          name: "presentation",
          paths: ["**/controllers/**", "**/pages/**", "**/components/**"],
        },
        {
          name: "application",
          paths: ["**/services/**", "**/use-cases/**"],
        },
        {
          name: "domain",
          paths: ["**/domain/**", "**/entities/**"],
        },
        {
          name: "infrastructure",
          paths: ["**/repositories/**", "**/database/**"],
        },
      ],
      rules: [
        { from: "presentation", canImport: ["application", "domain"] },
        { from: "application", canImport: ["domain"] },
        { from: "domain", canImport: [] },
        { from: "infrastructure", canImport: [] },
      ],
    },
  };
}

export const TS_LAYER_BOUNDARY_STRICT_CODE = "typescript:layer_boundary_strict";

export function createLayerBoundaryStrictRule(): LanguageRule {
  return {
    code: TS_LAYER_BOUNDARY_STRICT_CODE,
    name: "layer-boundary-strict",
    description: "Strict layer boundary enforcement with minimal cross-cutting imports",
    type: "layer_boundary",
    severity: "error",
    languages: ["typescript", "javascript"],
    defaultConfig: {
      layers: [
        {
          name: "presentation",
          paths: ["**/controllers/**", "**/pages/**", "**/components/**"],
        },
        {
          name: "application",
          paths: ["**/services/**", "**/use-cases/**"],
        },
        {
          name: "domain",
          paths: ["**/domain/**", "**/entities/**"],
        },
        {
          name: "infrastructure",
          paths: ["**/repositories/**", "**/database/**"],
        },
      ],
      rules: [
        { from: "presentation", canImport: ["application"] },
        { from: "application", canImport: ["domain"] },
        { from: "domain", canImport: [] },
        { from: "infrastructure", canImport: [] },
      ],
    },
  };
}
