/**
 * Tests for PHP Layer Boundary Rules
 */

import {
  PHP_LAYER_BOUNDARY_CODE,
  createLayerBoundaryRule,
  PHP_LAYER_BOUNDARY_CONTROLLERS_DB_CODE,
  createLayerBoundaryControllersDbRule,
} from "../layerBoundary.js";

describe("PHP Layer Boundary Rules", () => {
  describe("createLayerBoundaryRule", () => {
    it("should create rule with correct properties", () => {
      // Arrange & Act
      const rule = createLayerBoundaryRule();

      // Assert
      expect(rule.code).toBe(PHP_LAYER_BOUNDARY_CODE);
      expect(rule.name).toBe("domain-no-infrastructure");
      expect(rule.description).toBe("Domain layer must not depend on infrastructure layer");
      expect(rule.type).toBe("layer_boundary");
      expect(rule.severity).toBe("error");
      expect(rule.languages).toEqual(["php"]);
    });

    it("should have correct default config with source and forbidden patterns", () => {
      // Arrange & Act
      const rule = createLayerBoundaryRule();

      // Assert
      expect(rule.defaultConfig.source).toBe("src/Domain/**");
      expect(rule.defaultConfig.forbidden).toEqual(["src/Infrastructure/**", "src/Infra/**"]);
    });

    it("should forbid Infrastructure layer imports", () => {
      // Arrange & Act
      const rule = createLayerBoundaryRule();

      // Assert
      expect(rule.defaultConfig.forbidden).toContain("src/Infrastructure/**");
    });

    it("should forbid Infra layer imports (short form)", () => {
      // Arrange & Act
      const rule = createLayerBoundaryRule();

      // Assert
      expect(rule.defaultConfig.forbidden).toContain("src/Infra/**");
    });

    it("should have error severity for domain layer violations", () => {
      // Arrange & Act
      const rule = createLayerBoundaryRule();

      // Assert
      expect(rule.severity).toBe("error");
    });

    it("should apply to entire Domain directory", () => {
      // Arrange & Act
      const rule = createLayerBoundaryRule();

      // Assert
      expect(rule.defaultConfig.source).toMatch(/Domain/);
      expect(rule.defaultConfig.source).toMatch(/\*\*/);
    });
  });

  describe("createLayerBoundaryControllersDbRule", () => {
    it("should create rule with correct properties", () => {
      // Arrange & Act
      const rule = createLayerBoundaryControllersDbRule();

      // Assert
      expect(rule.code).toBe(PHP_LAYER_BOUNDARY_CONTROLLERS_DB_CODE);
      expect(rule.name).toBe("controllers-no-direct-db");
      expect(rule.description).toBe("Controllers must not directly access database layer");
      expect(rule.type).toBe("layer_boundary");
      expect(rule.severity).toBe("warning");
      expect(rule.languages).toEqual(["php"]);
    });

    it("should have correct default config with source and forbidden patterns", () => {
      // Arrange & Act
      const rule = createLayerBoundaryControllersDbRule();

      // Assert
      expect(rule.defaultConfig.source).toBe("src/**/Controller/**");
      expect(rule.defaultConfig.forbidden).toEqual(["src/**/Database/**", "src/**/Repository/**"]);
    });

    it("should forbid Database layer imports", () => {
      // Arrange & Act
      const rule = createLayerBoundaryControllersDbRule();

      // Assert
      expect(rule.defaultConfig.forbidden).toContain("src/**/Database/**");
    });

    it("should forbid Repository imports", () => {
      // Arrange & Act
      const rule = createLayerBoundaryControllersDbRule();

      // Assert
      expect(rule.defaultConfig.forbidden).toContain("src/**/Repository/**");
    });

    it("should have warning severity for controller violations", () => {
      // Arrange & Act
      const rule = createLayerBoundaryControllersDbRule();

      // Assert
      expect(rule.severity).toBe("warning");
    });

    it("should apply to all Controller directories", () => {
      // Arrange & Act
      const rule = createLayerBoundaryControllersDbRule();

      // Assert
      expect(rule.defaultConfig.source).toMatch(/Controller/);
      expect(rule.defaultConfig.source).toMatch(/\*\*/);
    });
  });

  describe("Rule Codes", () => {
    it("should have unique codes for each rule", () => {
      // Arrange & Act
      const codes = [PHP_LAYER_BOUNDARY_CODE, PHP_LAYER_BOUNDARY_CONTROLLERS_DB_CODE];

      // Assert
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);
    });

    it("should follow php namespace convention", () => {
      // Arrange & Act & Assert
      expect(PHP_LAYER_BOUNDARY_CODE).toMatch(/^php:/);
      expect(PHP_LAYER_BOUNDARY_CONTROLLERS_DB_CODE).toMatch(/^php:/);
    });

    it("should contain layer_boundary in code name", () => {
      // Arrange & Act & Assert
      expect(PHP_LAYER_BOUNDARY_CODE).toContain("layer_boundary");
      expect(PHP_LAYER_BOUNDARY_CONTROLLERS_DB_CODE).toContain("layer_boundary");
    });
  });

  describe("Rule Type Consistency", () => {
    it("both rules should have layer_boundary type", () => {
      // Arrange & Act
      const rule1 = createLayerBoundaryRule();
      const rule2 = createLayerBoundaryControllersDbRule();

      // Assert
      expect(rule1.type).toBe("layer_boundary");
      expect(rule2.type).toBe("layer_boundary");
    });
  });
});
