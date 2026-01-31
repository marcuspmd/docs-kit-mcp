import {
  runDocGuard,
  formatResult,
  type DocGuardDeps,
  type DocGuardOptions,
} from "../src/governance/docGuardCli.js";
import type { ChangeImpact } from "../src/indexer/symbol.types.js";
import type { DocRegistry, DocMapping } from "../src/docs/docRegistry.js";

function sym(name: string, file = "src/test.ts") {
  return { id: "t", name, kind: "function", file, startLine: 0, endLine: 5 };
}

function impact(name: string, changeType: string, docUpdateRequired = true): ChangeImpact {
  return {
    symbol: sym(name),
    changeType,
    diff: "",
    docUpdateRequired,
  } as unknown as ChangeImpact;
}

function mockRegistry(mappings: Record<string, DocMapping[]>): DocRegistry {
  return {
    rebuild: async () => {},
    findDocBySymbol: async (name: string) => mappings[name] ?? [],
    findSymbolsByDoc: async () => [],
    register: async () => {},
    unregister: async () => {},
  };
}

function makeDeps(
  impacts: ChangeImpact[],
  changedFiles: string[],
  mappings: Record<string, DocMapping[]>,
): DocGuardDeps {
  return {
    analyzeChanges: async () => impacts,
    registry: mockRegistry(mappings),
    getChangedFiles: async () => changedFiles,
  };
}

const baseOpts: DocGuardOptions = { repoPath: "/repo", base: "main" };

describe("runDocGuard", () => {
  test("passes when all impacted symbols have updated docs", async () => {
    const deps = makeDeps(
      [impact("createOrder", "signature_changed")],
      ["src/order.ts", "docs/domain/orders.md"],
      { createOrder: [{ symbolName: "createOrder", docPath: "docs/domain/orders.md" }] },
    );

    const result = await runDocGuard(baseOpts, deps);
    expect(result.passed).toBe(true);
    expect(result.totalChanges).toBe(1);
    expect(result.coveredChanges).toBe(1);
    expect(result.uncoveredChanges).toHaveLength(0);
  });

  test("fails when doc not updated for impacted symbol", async () => {
    const deps = makeDeps(
      [impact("createOrder", "signature_changed")],
      ["src/order.ts"],
      { createOrder: [{ symbolName: "createOrder", docPath: "docs/domain/orders.md" }] },
    );

    const result = await runDocGuard(baseOpts, deps);
    expect(result.passed).toBe(false);
    expect(result.uncoveredChanges).toHaveLength(1);
    expect(result.uncoveredChanges[0].symbolName).toBe("createOrder");
    expect(result.uncoveredChanges[0].reason).toBe("Linked doc was not updated in this PR");
  });

  test("fails when symbol has no linked doc", async () => {
    const deps = makeDeps(
      [impact("PaymentGateway", "added")],
      ["src/payment.ts"],
      {},
    );

    const result = await runDocGuard(baseOpts, deps);
    expect(result.passed).toBe(false);
    expect(result.uncoveredChanges[0].reason).toBe("No doc linked to this symbol");
  });

  test("skips impacts where docUpdateRequired is false", async () => {
    const deps = makeDeps(
      [impact("helper", "modified", false)],
      ["src/helper.ts"],
      {},
    );

    const result = await runDocGuard(baseOpts, deps);
    expect(result.passed).toBe(true);
    expect(result.totalChanges).toBe(0);
  });

  test("strict=false passes even with violations", async () => {
    const deps = makeDeps(
      [impact("createOrder", "added")],
      ["src/order.ts"],
      {},
    );

    const result = await runDocGuard({ ...baseOpts, strict: false }, deps);
    expect(result.passed).toBe(true);
    expect(result.uncoveredChanges).toHaveLength(1);
  });

  test("handles multiple impacts with mixed coverage", async () => {
    const deps = makeDeps(
      [
        impact("createOrder", "signature_changed"),
        impact("cancelOrder", "removed"),
        impact("getOrder", "added"),
      ],
      ["src/order.ts", "docs/domain/orders.md"],
      {
        createOrder: [{ symbolName: "createOrder", docPath: "docs/domain/orders.md" }],
        cancelOrder: [{ symbolName: "cancelOrder", docPath: "docs/domain/orders.md" }],
      },
    );

    const result = await runDocGuard(baseOpts, deps);
    expect(result.passed).toBe(false);
    expect(result.totalChanges).toBe(3);
    expect(result.coveredChanges).toBe(2);
    expect(result.uncoveredChanges).toHaveLength(1);
    expect(result.uncoveredChanges[0].symbolName).toBe("getOrder");
  });

  test("violation includes docPath when mapping exists", async () => {
    const deps = makeDeps(
      [impact("createOrder", "modified")],
      ["src/order.ts"],
      { createOrder: [{ symbolName: "createOrder", docPath: "docs/domain/orders.md" }] },
    );

    const result = await runDocGuard(baseOpts, deps);
    expect(result.uncoveredChanges[0].docPath).toBe("docs/domain/orders.md");
  });

  test("violation has undefined docPath when no mapping", async () => {
    const deps = makeDeps(
      [impact("Unknown", "added")],
      ["src/x.ts"],
      {},
    );

    const result = await runDocGuard(baseOpts, deps);
    expect(result.uncoveredChanges[0].docPath).toBeUndefined();
  });
});

describe("formatResult", () => {
  test("formats passing result", () => {
    const msg = formatResult({
      passed: true,
      totalChanges: 3,
      coveredChanges: 3,
      uncoveredChanges: [],
    });
    expect(msg).toBe("Doc-Guard: 3/3 changes covered.");
  });

  test("formats failing result with violations", () => {
    const msg = formatResult({
      passed: false,
      totalChanges: 2,
      coveredChanges: 0,
      uncoveredChanges: [
        {
          symbolName: "createOrder",
          file: "src/order.ts",
          changeType: "modified",
          docPath: "docs/orders.md",
          reason: "Linked doc was not updated in this PR",
        },
      ],
    });
    expect(msg).toContain("1 symbol(s) changed without doc updates");
    expect(msg).toContain("createOrder (src/order.ts)");
  });
});
