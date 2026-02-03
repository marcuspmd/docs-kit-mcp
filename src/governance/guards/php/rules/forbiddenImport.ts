/**
 * PHP Forbidden Import Rules
 * Prevents certain dependencies from being used in specific contexts.
 */

import type { LanguageRule } from "../../../types/languageGuards.js";

export const PHP_FORBIDDEN_IMPORT_CONTROLLERS_CODE = "php:forbidden_import_controllers";

export function createForbiddenImportControllersRule(): LanguageRule {
  return {
    code: PHP_FORBIDDEN_IMPORT_CONTROLLERS_CODE,
    name: "no-direct-db-in-controllers",
    description: "Controllers must not import database or repository implementations directly",
    type: "forbidden_import",
    severity: "warning",
    languages: ["php"],
    defaultConfig: {
      scope: "src/**/Controller/**",
      forbidden: ["**/Database/**", "**/Repository/**", "**/Doctrine/**"],
    },
  };
}

export const PHP_FORBIDDEN_IMPORT_DOMAIN_CODE = "php:forbidden_import_domain";

export function createForbiddenImportDomainRule(): LanguageRule {
  return {
    code: PHP_FORBIDDEN_IMPORT_DOMAIN_CODE,
    name: "no-framework-in-domain",
    description: "Domain layer should not depend on framework-specific code",
    type: "forbidden_import",
    severity: "error",
    languages: ["php"],
    defaultConfig: {
      scope: "src/Domain/**",
      forbidden: ["**/Symfony/**", "**/Laravel/**", "**/Doctrine/**", "**/Illuminate/**"],
    },
  };
}

export const PHP_FORBIDDEN_IMPORT_GLOBAL_STATE_CODE = "php:forbidden_global_state";

export function createForbiddenGlobalStateRule(): LanguageRule {
  return {
    code: PHP_FORBIDDEN_IMPORT_GLOBAL_STATE_CODE,
    name: "no-global-state",
    description: "Avoid direct usage of superglobals and global state",
    type: "forbidden_import",
    severity: "warning",
    languages: ["php"],
    defaultConfig: {
      forbidden: [
        "$_GET",
        "$_POST",
        "$_SESSION",
        "$_REQUEST",
        "$_COOKIE",
        "$_SERVER",
        "$_FILES",
        "$_ENV",
        "$GLOBALS",
      ],
    },
  };
}
