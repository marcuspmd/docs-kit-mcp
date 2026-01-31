import { createArchGuard } from "../src/governance/archGuard.js";
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
          config: { source: "src/domain/**", forbidden: ["src/infrastructure/**", "src/controllers/**"] },
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

      const violations = guard.analyze(symbols, [rel("c1", "db1", "uses"), rel("s1", "db1", "uses")]);
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
  });

  describe("loadRules", () => {
    it("loads rules from JSON config file", async () => {
      const tmpFile = join(tmpdir(), `arch-guard-test-${Date.now()}.json`);
      await writeFile(tmpFile, JSON.stringify({
        rules: [{ name: "test-rule", type: "naming_convention", config: { pattern: "^[A-Z]" } }],
      }));

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
