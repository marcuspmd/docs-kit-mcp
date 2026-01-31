import { createArchGuard } from "../src/governance/archGuard.js";
import {
  buildArchGuardBaseRules,
  getAllReservedNames,
  RESERVED_NAMES_BY_LANGUAGE,
} from "../src/governance/archGuardBase.js";
import type { CodeSymbol, SymbolRelationship } from "../src/indexer/symbol.types.js";
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

function sym(overrides: Partial<CodeSymbol> & { id: string; name: string }): CodeSymbol {
  return {
    kind: "class",
    file: "src/test.ts",
    startLine: 1,
    endLine: 10,
    ...overrides,
  } as CodeSymbol;
}

function rel(source: string, target: string, type: string): SymbolRelationship {
  return { sourceId: source, targetId: target, type } as SymbolRelationship;
}

describe("ArchGuard", () => {
  describe("layer_boundary", () => {
    it("detects domain importing from infrastructure", () => {
      const guard = createArchGuard();
      guard.setRules([
        {
          name: "domain-no-infra",
          type: "layer_boundary",
          config: { source: "src/domain/**", forbidden: ["src/infrastructure/**"] },
        },
      ]);

      const symbols = [
        sym({ id: "d1", name: "OrderService", file: "src/domain/order.ts" }),
        sym({ id: "i1", name: "DbClient", file: "src/infrastructure/db.ts" }),
      ];

      const violations = guard.analyze(symbols, [rel("d1", "i1", "uses")]);

      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe("domain-no-infra");
      expect(violations[0].file).toBe("src/domain/order.ts");
      expect(violations[0].symbolId).toBe("d1");
      expect(violations[0].severity).toBe("error");
      expect(violations[0].message).toContain("DbClient");
    });

    it("allows imports within the same layer", () => {
      const guard = createArchGuard();
      guard.setRules([
        {
          name: "domain-no-infra",
          type: "layer_boundary",
          config: { source: "src/domain/**", forbidden: ["src/infrastructure/**"] },
        },
      ]);

      const symbols = [
        sym({ id: "d1", name: "OrderService", file: "src/domain/order.ts" }),
        sym({ id: "d2", name: "UserService", file: "src/domain/user.ts" }),
      ];

      expect(guard.analyze(symbols, [rel("d1", "d2", "uses")])).toHaveLength(0);
    });

    it("supports multiple forbidden patterns", () => {
      const guard = createArchGuard();
      guard.setRules([
        {
          name: "domain-isolation",
          type: "layer_boundary",
          config: {
            source: "src/domain/**",
            forbidden: ["src/infrastructure/**", "src/controllers/**"],
          },
        },
      ]);

      const symbols = [
        sym({ id: "d1", name: "Order", file: "src/domain/order.ts" }),
        sym({ id: "c1", name: "OrderCtrl", file: "src/controllers/order.ts" }),
      ];

      const violations = guard.analyze(symbols, [rel("d1", "c1", "uses")]);
      expect(violations).toHaveLength(1);
    });

    it("respects custom severity", () => {
      const guard = createArchGuard();
      guard.setRules([
        {
          name: "soft",
          type: "layer_boundary",
          severity: "warning",
          config: { source: "src/domain/**", forbidden: ["src/infra/**"] },
        },
      ]);

      const symbols = [
        sym({ id: "d1", name: "A", file: "src/domain/a.ts" }),
        sym({ id: "i1", name: "B", file: "src/infra/b.ts" }),
      ];

      const violations = guard.analyze(symbols, [rel("d1", "i1", "calls")]);
      expect(violations[0].severity).toBe("warning");
    });
  });

  describe("forbidden_import", () => {
    it("detects forbidden dependency by file pattern", () => {
      const guard = createArchGuard();
      guard.setRules([
        {
          name: "no-lodash",
          type: "forbidden_import",
          config: { forbidden: ["node_modules/lodash/**"] },
        },
      ]);

      const symbols = [
        sym({ id: "s1", name: "Utils", file: "src/utils.ts" }),
        sym({ id: "l1", name: "lodash", file: "node_modules/lodash/index.js" }),
      ];

      const violations = guard.analyze(symbols, [rel("s1", "l1", "uses")]);
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe("no-lodash");
    });

    it("detects forbidden dependency by name pattern", () => {
      const guard = createArchGuard();
      guard.setRules([
        {
          name: "no-console",
          type: "forbidden_import",
          config: { forbidden: ["console*"] },
        },
      ]);

      const symbols = [
        sym({ id: "s1", name: "App", file: "src/app.ts" }),
        sym({ id: "c1", name: "consoleLogger", file: "src/logger.ts" }),
      ];

      const violations = guard.analyze(symbols, [rel("s1", "c1", "uses")]);
      expect(violations).toHaveLength(1);
    });

    it("scopes check to specific files", () => {
      const guard = createArchGuard();
      guard.setRules([
        {
          name: "no-db-in-controllers",
          type: "forbidden_import",
          config: { scope: "src/controllers/**", forbidden: ["src/db/**"] },
        },
      ]);

      const symbols = [
        sym({ id: "c1", name: "Ctrl", file: "src/controllers/foo.ts" }),
        sym({ id: "s1", name: "Svc", file: "src/services/foo.ts" }),
        sym({ id: "db1", name: "Db", file: "src/db/client.ts" }),
      ];

      const violations = guard.analyze(symbols, [
        rel("c1", "db1", "uses"),
        rel("s1", "db1", "uses"),
      ]);
      expect(violations).toHaveLength(1);
      expect(violations[0].file).toBe("src/controllers/foo.ts");
    });
  });

  describe("naming_convention", () => {
    it("detects symbols not matching naming pattern", () => {
      const guard = createArchGuard();
      guard.setRules([
        {
          name: "services-suffix",
          type: "naming_convention",
          config: { kind: "service", pattern: "Service$" },
        },
      ]);

      const symbols = [
        sym({ id: "s1", name: "OrderService", kind: "service", file: "src/a.ts" }),
        sym({ id: "s2", name: "PaymentHandler", kind: "service", file: "src/b.ts" }),
      ];

      const violations = guard.analyze(symbols, []);
      expect(violations).toHaveLength(1);
      expect(violations[0].symbolId).toBe("s2");
      expect(violations[0].severity).toBe("warning");
    });

    it("scopes by file glob", () => {
      const guard = createArchGuard();
      guard.setRules([
        {
          name: "test-naming",
          type: "naming_convention",
          config: { file: "tests/**", kind: "class", pattern: "Test$" },
        },
      ]);

      const symbols = [
        sym({ id: "t1", name: "OrderTest", kind: "class", file: "tests/order.test.ts" }),
        sym({ id: "t2", name: "BadName", kind: "class", file: "tests/bad.test.ts" }),
        sym({ id: "s1", name: "NoTest", kind: "class", file: "src/app.ts" }),
      ];

      const violations = guard.analyze(symbols, []);
      expect(violations).toHaveLength(1);
      expect(violations[0].symbolId).toBe("t2");
    });

    it("applies to all symbols when no kind filter", () => {
      const guard = createArchGuard();
      guard.setRules([
        {
          name: "no-underscore",
          type: "naming_convention",
          config: { pattern: "^[^_]" },
        },
      ]);

      const symbols = [
        sym({ id: "a", name: "Good", file: "src/a.ts" }),
        sym({ id: "b", name: "_bad", file: "src/b.ts" }),
      ];

      const violations = guard.analyze(symbols, []);
      expect(violations).toHaveLength(1);
      expect(violations[0].symbolId).toBe("b");
    });

    it("allows reserved names via allowNames (e.g. PHP __construct)", () => {
      const guard = createArchGuard();
      guard.setRules([
        {
          name: "method-camel-case",
          type: "naming_convention",
          config: {
            kind: "method",
            pattern: "^[a-z][a-zA-Z0-9]*$",
            allowNames: ["__construct", "__destruct", "constructor"],
          },
        },
      ]);

      const symbols = [
        sym({ id: "m1", name: "doSomething", kind: "method", file: "src/a.php" }),
        sym({ id: "m2", name: "__construct", kind: "method", file: "src/a.php" }),
        sym({ id: "m3", name: "Bad_Name", kind: "method", file: "src/b.php" }),
      ];

      const violations = guard.analyze(symbols, []);
      expect(violations).toHaveLength(1);
      expect(violations[0].symbolId).toBe("m3");
    });

    it("checks method-camel-case on short name when qualifiedName is ClassName.methodName", () => {
      const guard = createArchGuard();
      guard.setRules([
        {
          name: "method-camel-case",
          type: "naming_convention",
          config: { kind: "method", pattern: "^[a-z][a-zA-Z0-9]*$" },
        },
      ]);

      const symbols = [
        sym({
          id: "m1",
          name: "getCode",
          qualifiedName: "MyClass.getCode",
          kind: "method",
          file: "src/entity.ts",
        }),
        sym({
          id: "m2",
          name: "setName",
          qualifiedName: "MyClass.setName",
          kind: "method",
          file: "src/entity.ts",
        }),
        sym({
          id: "m3",
          name: "Bad_Method",
          qualifiedName: "MyClass.Bad_Method",
          kind: "method",
          file: "src/entity.ts",
        }),
      ];

      const violations = guard.analyze(symbols, []);
      expect(violations).toHaveLength(1);
      expect(violations[0].symbolId).toBe("m3");
    });

    it("checks function-camel-case on short name when qualifiedName has dot (e.g. module.myFunc)", () => {
      const guard = createArchGuard();
      guard.setRules([
        {
          name: "function-camel-case",
          type: "naming_convention",
          config: { kind: "function", pattern: "^[a-z][a-zA-Z0-9]*$" },
        },
      ]);

      const symbols = [
        sym({
          id: "f1",
          name: "formatDate",
          qualifiedName: "utils.formatDate",
          kind: "function",
          file: "src/utils.ts",
        }),
        sym({
          id: "f2",
          name: "Bad_Function",
          qualifiedName: "utils.Bad_Function",
          kind: "function",
          file: "src/utils.ts",
        }),
      ];

      const violations = guard.analyze(symbols, []);
      expect(violations).toHaveLength(1);
      expect(violations[0].symbolId).toBe("f2");
    });

    it("checks PascalCase on short name for qualified names (e.g. PHP 2.Domain\\Cte\\src\\Installment)", () => {
      const guard = createArchGuard();
      guard.setRules([
        {
          name: "class-pascal-case",
          type: "naming_convention",
          config: { kind: "class", pattern: "^[A-Z][a-zA-Z0-9]*$" },
        },
      ]);

      const symbols = [
        sym({
          id: "c1",
          name: "Installment",
          qualifiedName: "2.Domain\\Cte\\src\\Installment",
          kind: "class",
          file: "2.Domain/Cte/src/Installment.php",
        }),
        sym({
          id: "c2",
          name: "badClass",
          qualifiedName: "2.Domain\\Cte\\src\\badClass",
          kind: "class",
          file: "2.Domain/Cte/src/badClass.php",
        }),
      ];

      const violations = guard.analyze(symbols, []);
      expect(violations).toHaveLength(1);
      expect(violations[0].symbolId).toBe("c2");
    });

    it("checks class-pascal-case on short name when qualifiedName is module.ClassName (e.g. TS)", () => {
      const guard = createArchGuard();
      guard.setRules([
        {
          name: "class-pascal-case",
          type: "naming_convention",
          config: { kind: "class", pattern: "^[A-Z][a-zA-Z0-9]*$" },
        },
      ]);

      const symbols = [
        sym({
          id: "c1",
          name: "OrderService",
          qualifiedName: "domain.OrderService",
          kind: "class",
          file: "src/domain/order.ts",
        }),
        sym({
          id: "c2",
          name: "badClass",
          qualifiedName: "domain.badClass",
          kind: "class",
          file: "src/domain/other.ts",
        }),
      ];

      const violations = guard.analyze(symbols, []);
      expect(violations).toHaveLength(1);
      expect(violations[0].symbolId).toBe("c2");
    });

    it("ignores files matching ignore globs (e.g. tests, TestCase.php)", () => {
      const guard = createArchGuard();
      guard.setRules([
        {
          name: "class-pascal-case",
          type: "naming_convention",
          config: {
            kind: "class",
            pattern: "^[A-Z][a-zA-Z0-9]*$",
            ignore: ["**/tests/**", "**/TestCase.php", "0.Presentation/auth/tests/**"],
          },
        },
      ]);

      const symbols = [
        sym({ id: "a", name: "badClass", kind: "class", file: "src/domain/Foo.php" }),
        sym({ id: "b", name: "TestCase", kind: "class", file: "0.Presentation/auth/tests/TestCase.php" }),
        sym({ id: "c", name: "OtherTest", kind: "class", file: "tests/unit/OtherTest.php" }),
      ];

      const violations = guard.analyze(symbols, []);
      expect(violations).toHaveLength(1);
      expect(violations[0].symbolId).toBe("a");
    });
  });

  describe("max_complexity", () => {
    it("flags symbols exceeding cyclomatic complexity", () => {
      const guard = createArchGuard();
      guard.setRules([
        { name: "max-cc", type: "max_complexity", config: { max: 5 } },
      ]);

      const symbols = [
        sym({ id: "a", name: "simple", kind: "function", file: "src/a.ts", metrics: { cyclomaticComplexity: 3 } }),
        sym({ id: "b", name: "complex", kind: "function", file: "src/b.ts", metrics: { cyclomaticComplexity: 8 } }),
      ];

      const violations = guard.analyze(symbols, []);
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe("max-cc");
      expect(violations[0].symbolId).toBe("b");
      expect(violations[0].message).toContain("8");
    });
  });

  describe("max_parameters", () => {
    it("flags symbols exceeding parameter count", () => {
      const guard = createArchGuard();
      guard.setRules([
        { name: "max-params", type: "max_parameters", config: { max: 3 } },
      ]);

      const symbols = [
        sym({ id: "a", name: "few", kind: "function", file: "src/a.ts", metrics: { parameterCount: 2 } }),
        sym({ id: "b", name: "many", kind: "function", file: "src/b.ts", metrics: { parameterCount: 6 } }),
      ];

      const violations = guard.analyze(symbols, []);
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe("max-params");
      expect(violations[0].message).toContain("6");
    });
  });

  describe("max_lines", () => {
    it("flags symbols exceeding line count", () => {
      const guard = createArchGuard();
      guard.setRules([
        { name: "max-lines", type: "max_lines", config: { max: 20 } },
      ]);

      const symbols = [
        sym({ id: "a", name: "short", kind: "function", file: "src/a.ts", startLine: 1, endLine: 10 }),
        sym({ id: "b", name: "long", kind: "function", file: "src/b.ts", startLine: 1, endLine: 50 }),
      ];

      const violations = guard.analyze(symbols, []);
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe("max-lines");
      expect(violations[0].message).toContain("50");
    });
  });

  describe("missing_return_type", () => {
    it("flags methods/functions without declared return type", () => {
      const guard = createArchGuard();
      guard.setRules([
        { name: "require-return", type: "missing_return_type", config: {} },
      ]);

      const symbols = [
        sym({ id: "a", name: "typed", kind: "function", file: "src/a.ts", signature: "foo(): number" }),
        sym({ id: "b", name: "untyped", kind: "function", file: "src/b.ts", signature: "bar()" }),
      ];

      const violations = guard.analyze(symbols, []);
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe("require-return");
      expect(violations[0].symbolId).toBe("b");
    });
  });

  describe("loadRules", () => {
    it("loads rules from JSON config file", async () => {
      const tmpFile = join(tmpdir(), `arch-guard-test-${Date.now()}.json`);
      await writeFile(
        tmpFile,
        JSON.stringify({
          rules: [{ name: "test-rule", type: "naming_convention", config: { pattern: "^[A-Z]" } }],
        }),
      );

      try {
        const guard = createArchGuard();
        await guard.loadRules(tmpFile);

        const violations = guard.analyze(
          [sym({ id: "a", name: "lowercase", file: "src/a.ts" })],
          [],
        );
        expect(violations).toHaveLength(1);
        expect(violations[0].rule).toBe("test-rule");
      } finally {
        await unlink(tmpFile);
      }
    });
  });

  describe("archGuardBase", () => {
    it("buildArchGuardBaseRules includes PHP __construct in allowNames for method rule", () => {
      const rules = buildArchGuardBaseRules({ languages: ["php"], namingConvention: true });
      const methodRule = rules.find((r) => r.type === "naming_convention" && r.config.kind === "method");
      expect(methodRule).toBeDefined();
      const allowNames = methodRule!.config.allowNames as string[] | undefined;
      expect(allowNames).toContain("__construct");
      expect(allowNames).toContain("__destruct");
    });

    it("getAllReservedNames returns union for multiple languages", () => {
      const names = getAllReservedNames(["php", "ts"]);
      expect(names).toContain("__construct");
      expect(names).toContain("constructor");
    });

    it("RESERVED_NAMES_BY_LANGUAGE has php and python magic methods", () => {
      expect(RESERVED_NAMES_BY_LANGUAGE.php).toContain("__construct");
      expect(RESERVED_NAMES_BY_LANGUAGE.python).toContain("__init__");
    });
  });

  describe("multiple rules", () => {
    it("reports violations from multiple rules at once", () => {
      const guard = createArchGuard();
      guard.setRules([
        {
          name: "layer",
          type: "layer_boundary",
          config: { source: "src/domain/**", forbidden: ["src/infra/**"] },
        },
        {
          name: "naming",
          type: "naming_convention",
          config: { kind: "class", pattern: "^[A-Z]" },
        },
      ]);

      const symbols = [
        sym({ id: "d1", name: "order", kind: "class", file: "src/domain/order.ts" }),
        sym({ id: "i1", name: "Db", file: "src/infra/db.ts" }),
      ];

      const violations = guard.analyze(symbols, [rel("d1", "i1", "uses")]);
      expect(violations).toHaveLength(2);
      expect(violations.map((v) => v.rule).sort()).toEqual(["layer", "naming"]);
    });
  });
});
