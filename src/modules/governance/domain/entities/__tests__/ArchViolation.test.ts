import { describe, it, expect } from "@jest/globals";
import { ArchViolation, type ArchViolationProps } from "../ArchViolation.js";

describe("ArchViolation Entity", () => {
  const baseProps: ArchViolationProps = {
    rule: "no-circular-dependencies",
    file: "src/services/UserService.ts",
    message: "Circular dependency detected",
    severity: "error",
  };

  describe("create", () => {
    it("should create an ArchViolation instance", () => {
      const violation = ArchViolation.create(baseProps);

      expect(violation).toBeInstanceOf(ArchViolation);
    });

    it("should generate ID from rule, file, and symbolId", () => {
      const violation = ArchViolation.create({
        ...baseProps,
        symbolId: "UserService",
      });

      expect(violation.id).toBe(
        "no-circular-dependencies::src/services/UserService.ts::UserService",
      );
    });

    it("should generate ID with 'global' when symbolId is undefined", () => {
      const violation = ArchViolation.create(baseProps);

      expect(violation.id).toBe("no-circular-dependencies::src/services/UserService.ts::global");
    });

    it("should create without symbolId", () => {
      const violation = ArchViolation.create(baseProps);

      expect(violation.symbolId).toBeUndefined();
    });

    it("should create with symbolId", () => {
      const violation = ArchViolation.create({
        ...baseProps,
        symbolId: "testSymbol",
      });

      expect(violation.symbolId).toBe("testSymbol");
    });
  });

  describe("getters", () => {
    it("should return rule", () => {
      const violation = ArchViolation.create(baseProps);

      expect(violation.rule).toBe("no-circular-dependencies");
    });

    it("should return file", () => {
      const violation = ArchViolation.create(baseProps);

      expect(violation.file).toBe("src/services/UserService.ts");
    });

    it("should return message", () => {
      const violation = ArchViolation.create(baseProps);

      expect(violation.message).toBe("Circular dependency detected");
    });

    it("should return severity", () => {
      const violation = ArchViolation.create(baseProps);

      expect(violation.severity).toBe("error");
    });

    it("should return undefined symbolId when not provided", () => {
      const violation = ArchViolation.create(baseProps);

      expect(violation.symbolId).toBeUndefined();
    });

    it("should return symbolId when provided", () => {
      const violation = ArchViolation.create({
        ...baseProps,
        symbolId: "MyClass",
      });

      expect(violation.symbolId).toBe("MyClass");
    });
  });

  describe("all severities", () => {
    const severities: Array<ArchViolationProps["severity"]> = [
      "info",
      "warning",
      "error",
      "critical",
    ];

    severities.forEach((severity) => {
      it(`should create violation with severity: ${severity}`, () => {
        const violation = ArchViolation.create({ ...baseProps, severity });

        expect(violation.severity).toBe(severity);
      });
    });
  });

  describe("different rules", () => {
    const rules = [
      "no-circular-dependencies",
      "layer-violation",
      "forbidden-import",
      "naming-convention",
    ];

    rules.forEach((rule) => {
      it(`should create violation with rule: ${rule}`, () => {
        const violation = ArchViolation.create({ ...baseProps, rule });

        expect(violation.rule).toBe(rule);
      });
    });
  });
});
