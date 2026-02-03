/**
 * Tests for PHP Forbidden Import Rules
 */

import {
  PHP_FORBIDDEN_IMPORT_CONTROLLERS_CODE,
  createForbiddenImportControllersRule,
  PHP_FORBIDDEN_IMPORT_DOMAIN_CODE,
  createForbiddenImportDomainRule,
  PHP_FORBIDDEN_IMPORT_GLOBAL_STATE_CODE,
  createForbiddenGlobalStateRule,
} from "../forbiddenImport.js";

describe("PHP Forbidden Import Rules", () => {
  describe("createForbiddenImportControllersRule", () => {
    it("should create rule with correct properties", () => {
      // Arrange & Act
      const rule = createForbiddenImportControllersRule();

      // Assert
      expect(rule.code).toBe(PHP_FORBIDDEN_IMPORT_CONTROLLERS_CODE);
      expect(rule.name).toBe("no-direct-db-in-controllers");
      expect(rule.description).toBe(
        "Controllers must not import database or repository implementations directly",
      );
      expect(rule.type).toBe("forbidden_import");
      expect(rule.severity).toBe("warning");
      expect(rule.languages).toEqual(["php"]);
    });

    it("should have correct default config with scope and forbidden patterns", () => {
      // Arrange & Act
      const rule = createForbiddenImportControllersRule();

      // Assert
      expect(rule.defaultConfig.scope).toBe("src/**/Controller/**");
      expect(rule.defaultConfig.forbidden).toEqual([
        "**/Database/**",
        "**/Repository/**",
        "**/Doctrine/**",
      ]);
    });

    it("should forbid database layer imports", () => {
      // Arrange & Act
      const rule = createForbiddenImportControllersRule();

      // Assert
      expect(rule.defaultConfig.forbidden).toContain("**/Database/**");
    });

    it("should forbid repository imports", () => {
      // Arrange & Act
      const rule = createForbiddenImportControllersRule();

      // Assert
      expect(rule.defaultConfig.forbidden).toContain("**/Repository/**");
    });

    it("should forbid Doctrine imports", () => {
      // Arrange & Act
      const rule = createForbiddenImportControllersRule();

      // Assert
      expect(rule.defaultConfig.forbidden).toContain("**/Doctrine/**");
    });
  });

  describe("createForbiddenImportDomainRule", () => {
    it("should create rule with correct properties", () => {
      // Arrange & Act
      const rule = createForbiddenImportDomainRule();

      // Assert
      expect(rule.code).toBe(PHP_FORBIDDEN_IMPORT_DOMAIN_CODE);
      expect(rule.name).toBe("no-framework-in-domain");
      expect(rule.description).toBe("Domain layer should not depend on framework-specific code");
      expect(rule.type).toBe("forbidden_import");
      expect(rule.severity).toBe("error");
      expect(rule.languages).toEqual(["php"]);
    });

    it("should have correct default config with scope and forbidden patterns", () => {
      // Arrange & Act
      const rule = createForbiddenImportDomainRule();

      // Assert
      expect(rule.defaultConfig.scope).toBe("src/Domain/**");
      expect(rule.defaultConfig.forbidden).toEqual([
        "**/Symfony/**",
        "**/Laravel/**",
        "**/Doctrine/**",
        "**/Illuminate/**",
      ]);
    });

    it("should forbid Symfony framework imports", () => {
      // Arrange & Act
      const rule = createForbiddenImportDomainRule();

      // Assert
      expect(rule.defaultConfig.forbidden).toContain("**/Symfony/**");
    });

    it("should forbid Laravel framework imports", () => {
      // Arrange & Act
      const rule = createForbiddenImportDomainRule();

      // Assert
      expect(rule.defaultConfig.forbidden).toContain("**/Laravel/**");
    });

    it("should forbid Illuminate imports", () => {
      // Arrange & Act
      const rule = createForbiddenImportDomainRule();

      // Assert
      expect(rule.defaultConfig.forbidden).toContain("**/Illuminate/**");
    });

    it("should have error severity for domain layer violations", () => {
      // Arrange & Act
      const rule = createForbiddenImportDomainRule();

      // Assert
      expect(rule.severity).toBe("error");
    });
  });

  describe("createForbiddenGlobalStateRule", () => {
    it("should create rule with correct properties", () => {
      // Arrange & Act
      const rule = createForbiddenGlobalStateRule();

      // Assert
      expect(rule.code).toBe(PHP_FORBIDDEN_IMPORT_GLOBAL_STATE_CODE);
      expect(rule.name).toBe("no-global-state");
      expect(rule.description).toBe("Avoid direct usage of superglobals and global state");
      expect(rule.type).toBe("forbidden_import");
      expect(rule.severity).toBe("warning");
      expect(rule.languages).toEqual(["php"]);
    });

    it("should forbid all PHP superglobals", () => {
      // Arrange & Act
      const rule = createForbiddenGlobalStateRule();

      // Assert
      expect(rule.defaultConfig.forbidden).toContain("$_GET");
      expect(rule.defaultConfig.forbidden).toContain("$_POST");
      expect(rule.defaultConfig.forbidden).toContain("$_SESSION");
      expect(rule.defaultConfig.forbidden).toContain("$_REQUEST");
      expect(rule.defaultConfig.forbidden).toContain("$_COOKIE");
      expect(rule.defaultConfig.forbidden).toContain("$_SERVER");
      expect(rule.defaultConfig.forbidden).toContain("$_FILES");
      expect(rule.defaultConfig.forbidden).toContain("$_ENV");
      expect(rule.defaultConfig.forbidden).toContain("$GLOBALS");
    });

    it("should have 9 superglobal entries", () => {
      // Arrange & Act
      const rule = createForbiddenGlobalStateRule();

      // Assert
      expect(rule.defaultConfig.forbidden).toHaveLength(9);
    });

    it("should not have scope defined (applies globally)", () => {
      // Arrange & Act
      const rule = createForbiddenGlobalStateRule();

      // Assert
      expect(rule.defaultConfig.scope).toBeUndefined();
    });
  });

  describe("Rule Codes", () => {
    it("should have unique codes for each rule", () => {
      // Arrange & Act
      const codes = [
        PHP_FORBIDDEN_IMPORT_CONTROLLERS_CODE,
        PHP_FORBIDDEN_IMPORT_DOMAIN_CODE,
        PHP_FORBIDDEN_IMPORT_GLOBAL_STATE_CODE,
      ];

      // Assert
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);
    });

    it("should follow php namespace convention", () => {
      // Arrange & Act & Assert
      expect(PHP_FORBIDDEN_IMPORT_CONTROLLERS_CODE).toMatch(/^php:/);
      expect(PHP_FORBIDDEN_IMPORT_DOMAIN_CODE).toMatch(/^php:/);
      expect(PHP_FORBIDDEN_IMPORT_GLOBAL_STATE_CODE).toMatch(/^php:/);
    });
  });
});
