/**
 * TypeScript Forbidden Import Rules
 * Prevents unwanted imports from specific modules or layers.
 */

import type { LanguageRule } from "../../../types/languageGuards.js";

export const TS_FORBIDDEN_IMPORT_INTERNAL_CODE = "typescript:forbidden_import_internal";

export function createForbiddenImportInternalRule(): LanguageRule {
  return {
    code: TS_FORBIDDEN_IMPORT_INTERNAL_CODE,
    name: "forbidden-import-internal",
    description: "Prevents importing internal/private modules directly",
    type: "forbidden_import",
    severity: "error",
    languages: ["typescript", "javascript"],
    defaultConfig: {
      forbiddenPatterns: ["**/internal/*", "**/private/*", "**/__internal/**"],
    },
  };
}

export const TS_FORBIDDEN_IMPORT_BARREL_CODE = "typescript:forbidden_import_barrel";

export function createForbiddenImportBarrelRule(): LanguageRule {
  return {
    code: TS_FORBIDDEN_IMPORT_BARREL_CODE,
    name: "forbidden-import-barrel",
    description: "Prevents circular imports through barrel (index) files",
    type: "forbidden_import",
    severity: "warning",
    languages: ["typescript", "javascript"],
    defaultConfig: {
      checkIndexImports: true,
    },
  };
}

export const TS_FORBIDDEN_IMPORT_EXTERNAL_CODE = "typescript:forbidden_import_external";

export function createForbiddenImportExternalRule(): LanguageRule {
  return {
    code: TS_FORBIDDEN_IMPORT_EXTERNAL_CODE,
    name: "forbidden-import-external",
    description: "Prevents importing external packages not in allowlist",
    type: "forbidden_import",
    severity: "error",
    languages: ["typescript", "javascript"],
    defaultConfig: {
      allowedPackages: [],
      forbiddenPackages: [],
    },
  };
}
