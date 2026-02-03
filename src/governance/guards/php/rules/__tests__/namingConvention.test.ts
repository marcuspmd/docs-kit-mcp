/**
 * Tests for PHP Naming Convention Rules
 */

import {
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
} from "../namingConvention.js";

describe("PHP Naming Convention Rules", () => {
  describe("PHP_MAGIC_METHODS", () => {
    it("should include all standard PHP magic methods", () => {
      // Arrange & Act & Assert
      expect(PHP_MAGIC_METHODS).toContain("__construct");
      expect(PHP_MAGIC_METHODS).toContain("__destruct");
      expect(PHP_MAGIC_METHODS).toContain("__call");
      expect(PHP_MAGIC_METHODS).toContain("__callStatic");
      expect(PHP_MAGIC_METHODS).toContain("__get");
      expect(PHP_MAGIC_METHODS).toContain("__set");
      expect(PHP_MAGIC_METHODS).toContain("__isset");
      expect(PHP_MAGIC_METHODS).toContain("__unset");
      expect(PHP_MAGIC_METHODS).toContain("__sleep");
      expect(PHP_MAGIC_METHODS).toContain("__wakeup");
      expect(PHP_MAGIC_METHODS).toContain("__serialize");
      expect(PHP_MAGIC_METHODS).toContain("__unserialize");
      expect(PHP_MAGIC_METHODS).toContain("__toString");
      expect(PHP_MAGIC_METHODS).toContain("__invoke");
      expect(PHP_MAGIC_METHODS).toContain("__set_state");
      expect(PHP_MAGIC_METHODS).toContain("__clone");
      expect(PHP_MAGIC_METHODS).toContain("__debugInfo");
    });

    it("should have 17 magic methods", () => {
      // Arrange & Act & Assert
      expect(PHP_MAGIC_METHODS).toHaveLength(17);
    });

    it("all magic methods should start with double underscore", () => {
      // Arrange & Act & Assert
      PHP_MAGIC_METHODS.forEach((method) => {
        expect(method).toMatch(/^__/);
      });
    });
  });

  describe("createNamingClassRule", () => {
    it("should create rule with correct properties", () => {
      // Arrange & Act
      const rule = createNamingClassRule();

      // Assert
      expect(rule.code).toBe(PHP_NAMING_CLASS_CODE);
      expect(rule.name).toBe("class-pascal-case");
      expect(rule.description).toBe("PHP classes should be PascalCase");
      expect(rule.type).toBe("naming_convention");
      expect(rule.severity).toBe("warning");
      expect(rule.languages).toEqual(["php"]);
    });

    it("should enforce PascalCase pattern", () => {
      // Arrange & Act
      const rule = createNamingClassRule();

      // Assert
      expect(rule.defaultConfig.pattern).toBe("^[A-Z][a-zA-Z0-9]*$");
      expect(rule.defaultConfig.kind).toBe("class");
    });

    it("pattern should match valid PascalCase names", () => {
      // Arrange
      const rule = createNamingClassRule();
      const pattern = new RegExp(rule.defaultConfig.pattern as string);

      // Act & Assert
      expect(pattern.test("MyClass")).toBe(true);
      expect(pattern.test("UserRepository")).toBe(true);
      expect(pattern.test("HTTPClient")).toBe(true);
    });

    it("pattern should reject invalid names", () => {
      // Arrange
      const rule = createNamingClassRule();
      const pattern = new RegExp(rule.defaultConfig.pattern as string);

      // Act & Assert
      expect(pattern.test("myClass")).toBe(false);
      expect(pattern.test("my_class")).toBe(false);
      expect(pattern.test("MY_CLASS")).toBe(false);
    });
  });

  describe("createNamingInterfaceRule", () => {
    it("should create rule with correct properties", () => {
      // Arrange & Act
      const rule = createNamingInterfaceRule();

      // Assert
      expect(rule.code).toBe(PHP_NAMING_INTERFACE_CODE);
      expect(rule.name).toBe("interface-pascal-case");
      expect(rule.description).toBe(
        "PHP interfaces should be PascalCase (optionally with 'Interface' suffix)",
      );
      expect(rule.type).toBe("naming_convention");
      expect(rule.severity).toBe("warning");
      expect(rule.languages).toEqual(["php"]);
    });

    it("should allow optional Interface suffix", () => {
      // Arrange
      const rule = createNamingInterfaceRule();
      const pattern = new RegExp(rule.defaultConfig.pattern as string);

      // Act & Assert
      expect(pattern.test("UserRepository")).toBe(true);
      expect(pattern.test("UserRepositoryInterface")).toBe(true);
      expect(pattern.test("LoggerInterface")).toBe(true);
    });

    it("should apply to interface kind", () => {
      // Arrange & Act
      const rule = createNamingInterfaceRule();

      // Assert
      expect(rule.defaultConfig.kind).toBe("interface");
    });
  });

  describe("createNamingTraitRule", () => {
    it("should create rule with correct properties", () => {
      // Arrange & Act
      const rule = createNamingTraitRule();

      // Assert
      expect(rule.code).toBe(PHP_NAMING_TRAIT_CODE);
      expect(rule.name).toBe("trait-pascal-case");
      expect(rule.description).toBe(
        "PHP traits should be PascalCase (optionally with 'Trait' suffix)",
      );
      expect(rule.type).toBe("naming_convention");
      expect(rule.severity).toBe("warning");
      expect(rule.languages).toEqual(["php"]);
    });

    it("should allow optional Trait suffix", () => {
      // Arrange
      const rule = createNamingTraitRule();
      const pattern = new RegExp(rule.defaultConfig.pattern as string);

      // Act & Assert
      expect(pattern.test("Timestampable")).toBe(true);
      expect(pattern.test("TimestampableTrait")).toBe(true);
      expect(pattern.test("LoggerTrait")).toBe(true);
    });

    it("should apply to trait kind", () => {
      // Arrange & Act
      const rule = createNamingTraitRule();

      // Assert
      expect(rule.defaultConfig.kind).toBe("trait");
    });
  });

  describe("createNamingMethodRule", () => {
    it("should create rule with correct properties", () => {
      // Arrange & Act
      const rule = createNamingMethodRule();

      // Assert
      expect(rule.code).toBe(PHP_NAMING_METHOD_CODE);
      expect(rule.name).toBe("method-camel-case");
      expect(rule.description).toBe(
        "PHP methods should be camelCase (magic methods like __construct allowed)",
      );
      expect(rule.type).toBe("naming_convention");
      expect(rule.severity).toBe("warning");
      expect(rule.languages).toEqual(["php"]);
    });

    it("should enforce camelCase pattern", () => {
      // Arrange
      const rule = createNamingMethodRule();
      const pattern = new RegExp(rule.defaultConfig.pattern as string);

      // Act & Assert
      expect(pattern.test("getUserById")).toBe(true);
      expect(pattern.test("save")).toBe(true);
      expect(pattern.test("findAll")).toBe(true);
    });

    it("should reject PascalCase and snake_case", () => {
      // Arrange
      const rule = createNamingMethodRule();
      const pattern = new RegExp(rule.defaultConfig.pattern as string);

      // Act & Assert
      expect(pattern.test("GetUserById")).toBe(false);
      expect(pattern.test("get_user_by_id")).toBe(false);
    });

    it("should allow magic methods", () => {
      // Arrange & Act
      const rule = createNamingMethodRule();

      // Assert
      expect(rule.defaultConfig.allowNames).toEqual(PHP_MAGIC_METHODS);
      expect(rule.defaultConfig.allowNames).toContain("__construct");
      expect(rule.defaultConfig.allowNames).toContain("__toString");
    });

    it("should apply to method kind", () => {
      // Arrange & Act
      const rule = createNamingMethodRule();

      // Assert
      expect(rule.defaultConfig.kind).toBe("method");
    });
  });

  describe("createNamingFunctionRule", () => {
    it("should create rule with correct properties", () => {
      // Arrange & Act
      const rule = createNamingFunctionRule();

      // Assert
      expect(rule.code).toBe(PHP_NAMING_FUNCTION_CODE);
      expect(rule.name).toBe("function-camel-case");
      expect(rule.description).toBe("PHP functions should be camelCase or snake_case");
      expect(rule.type).toBe("naming_convention");
      expect(rule.severity).toBe("warning");
      expect(rule.languages).toEqual(["php"]);
    });

    it("should allow both camelCase and snake_case", () => {
      // Arrange
      const rule = createNamingFunctionRule();
      const pattern = new RegExp(rule.defaultConfig.pattern as string);

      // Act & Assert - camelCase
      expect(pattern.test("getUserById")).toBe(true);
      expect(pattern.test("processData")).toBe(true);

      // Act & Assert - snake_case
      expect(pattern.test("get_user_by_id")).toBe(true);
      expect(pattern.test("process_data")).toBe(true);
    });

    it("should reject PascalCase", () => {
      // Arrange
      const rule = createNamingFunctionRule();
      const pattern = new RegExp(rule.defaultConfig.pattern as string);

      // Act & Assert
      expect(pattern.test("GetUserById")).toBe(false);
      expect(pattern.test("ProcessData")).toBe(false);
    });

    it("should apply to function kind", () => {
      // Arrange & Act
      const rule = createNamingFunctionRule();

      // Assert
      expect(rule.defaultConfig.kind).toBe("function");
    });
  });

  describe("createNamingConstantRule", () => {
    it("should create rule with correct properties", () => {
      // Arrange & Act
      const rule = createNamingConstantRule();

      // Assert
      expect(rule.code).toBe(PHP_NAMING_CONSTANT_CODE);
      expect(rule.name).toBe("constant-upper-case");
      expect(rule.description).toBe("PHP class constants should be UPPER_SNAKE_CASE");
      expect(rule.type).toBe("naming_convention");
      expect(rule.severity).toBe("warning");
      expect(rule.languages).toEqual(["php"]);
    });

    it("should enforce UPPER_SNAKE_CASE pattern", () => {
      // Arrange
      const rule = createNamingConstantRule();
      const pattern = new RegExp(rule.defaultConfig.pattern as string);

      // Act & Assert
      expect(pattern.test("MAX_SIZE")).toBe(true);
      expect(pattern.test("DEFAULT_TIMEOUT")).toBe(true);
      expect(pattern.test("VERSION")).toBe(true);
      expect(pattern.test("API_KEY")).toBe(true);
    });

    it("should reject lowercase and mixed case", () => {
      // Arrange
      const rule = createNamingConstantRule();
      const pattern = new RegExp(rule.defaultConfig.pattern as string);

      // Act & Assert
      expect(pattern.test("maxSize")).toBe(false);
      expect(pattern.test("Max_Size")).toBe(false);
      expect(pattern.test("max_size")).toBe(false);
    });

    it("should apply to constant kind", () => {
      // Arrange & Act
      const rule = createNamingConstantRule();

      // Assert
      expect(rule.defaultConfig.kind).toBe("constant");
    });
  });

  describe("Rule Codes", () => {
    it("should have unique codes for all naming rules", () => {
      // Arrange & Act
      const codes = [
        PHP_NAMING_CLASS_CODE,
        PHP_NAMING_INTERFACE_CODE,
        PHP_NAMING_TRAIT_CODE,
        PHP_NAMING_METHOD_CODE,
        PHP_NAMING_FUNCTION_CODE,
        PHP_NAMING_CONSTANT_CODE,
      ];

      // Assert
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);
    });

    it("all codes should follow php namespace convention", () => {
      // Arrange & Act
      const codes = [
        PHP_NAMING_CLASS_CODE,
        PHP_NAMING_INTERFACE_CODE,
        PHP_NAMING_TRAIT_CODE,
        PHP_NAMING_METHOD_CODE,
        PHP_NAMING_FUNCTION_CODE,
        PHP_NAMING_CONSTANT_CODE,
      ];

      // Assert
      codes.forEach((code) => {
        expect(code).toMatch(/^php:/);
        expect(code).toContain("naming");
      });
    });
  });

  describe("Rule Type Consistency", () => {
    it("all naming rules should have naming_convention type", () => {
      // Arrange & Act
      const rules = [
        createNamingClassRule(),
        createNamingInterfaceRule(),
        createNamingTraitRule(),
        createNamingMethodRule(),
        createNamingFunctionRule(),
        createNamingConstantRule(),
      ];

      // Assert
      rules.forEach((rule) => {
        expect(rule.type).toBe("naming_convention");
      });
    });

    it("all naming rules should have warning severity", () => {
      // Arrange & Act
      const rules = [
        createNamingClassRule(),
        createNamingInterfaceRule(),
        createNamingTraitRule(),
        createNamingMethodRule(),
        createNamingFunctionRule(),
        createNamingConstantRule(),
      ];

      // Assert
      rules.forEach((rule) => {
        expect(rule.severity).toBe("warning");
      });
    });
  });

  describe("Kind Specificity", () => {
    it("each rule should target a specific kind", () => {
      // Arrange & Act & Assert
      expect(createNamingClassRule().defaultConfig.kind).toBe("class");
      expect(createNamingInterfaceRule().defaultConfig.kind).toBe("interface");
      expect(createNamingTraitRule().defaultConfig.kind).toBe("trait");
      expect(createNamingMethodRule().defaultConfig.kind).toBe("method");
      expect(createNamingFunctionRule().defaultConfig.kind).toBe("function");
      expect(createNamingConstantRule().defaultConfig.kind).toBe("constant");
    });

    it("all kinds should be unique", () => {
      // Arrange & Act
      const kinds = [
        createNamingClassRule().defaultConfig.kind,
        createNamingInterfaceRule().defaultConfig.kind,
        createNamingTraitRule().defaultConfig.kind,
        createNamingMethodRule().defaultConfig.kind,
        createNamingFunctionRule().defaultConfig.kind,
        createNamingConstantRule().defaultConfig.kind,
      ];

      // Assert
      const uniqueKinds = new Set(kinds);
      expect(uniqueKinds.size).toBe(kinds.length);
    });
  });
});
