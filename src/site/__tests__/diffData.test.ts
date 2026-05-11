import type { ChangeImpact, CodeSymbol } from "../../indexer/symbol.types.js";
import type { LoadedSiteData } from "../dataLoader.js";
import { buildDiffSiteMetadata, filterSiteDataForDiff } from "../diffData.js";

function makeSymbol(
  overrides: Partial<CodeSymbol> & Pick<CodeSymbol, "id" | "name" | "kind" | "file">,
): CodeSymbol {
  return {
    startLine: 1,
    endLine: 5,
    ...overrides,
  };
}

function makeImpact(symbol: CodeSymbol): ChangeImpact {
  return {
    symbol,
    changeType: "signature_changed",
    diff: "+ changed",
    structuredDiff: {
      hunks: [
        {
          oldStart: 1,
          oldLines: 1,
          newStart: 1,
          newLines: 1,
          lines: [
            {
              newLineNumber: 1,
              newText: "changed",
              tone: "added",
            },
          ],
        },
      ],
      addedLines: 1,
      removedLines: 0,
    },
    docUpdateRequired: true,
  };
}

describe("diffData", () => {
  it("filters site data to changed files, impacted symbols, parents, and linked docs", () => {
    const service = makeSymbol({
      id: "service",
      name: "OrderService",
      kind: "class",
      file: "src/orders/service.ts",
      docRef: "docs/orders.md",
    });
    const method = makeSymbol({
      id: "method",
      name: "createOrder",
      kind: "method",
      file: "src/orders/service.ts",
      startLine: 2,
      parent: service.id,
      docRef: "docs/orders.md",
    });
    const unrelated = makeSymbol({
      id: "unrelated",
      name: "UserService",
      kind: "class",
      file: "src/users/service.ts",
    });

    const data: LoadedSiteData = {
      symbols: [service, method, unrelated],
      relationships: [
        { source_id: service.id, target_id: method.id, type: "contains" },
        { source_id: service.id, target_id: unrelated.id, type: "uses" },
      ],
      patterns: [
        {
          kind: "service",
          symbols: [service.id, unrelated.id],
          confidence: 0.9,
          violations: [],
        },
      ],
      files: ["src/orders/service.ts", "src/users/service.ts"],
      archViolations: [
        {
          rule: "layer",
          file: "src/orders/service.ts",
          symbol_id: service.id,
          message: "ignored for diff preview",
          severity: "error",
        },
      ],
      reaperFindings: [],
      docEntries: [
        { path: "docs/orders.md", title: "Orders" },
        { path: "docs/users.md", title: "Users" },
      ],
      docsConfigDir: null,
    };

    const filtered = filterSiteDataForDiff(data, {
      impacts: [makeImpact(method)],
      changedFiles: ["src/orders/service.ts", "docs/orders.md"],
    });

    expect(filtered.symbols.map((symbol) => symbol.id)).toEqual([service.id, method.id]);
    expect(filtered.relationships).toEqual([
      { source_id: service.id, target_id: method.id, type: "contains" },
    ]);
    expect(filtered.patterns[0].symbols).toEqual([service.id]);
    expect(filtered.files).toEqual(["src/orders/service.ts"]);
    expect(filtered.docEntries).toEqual([{ path: "docs/orders.md", title: "Orders" }]);
    expect(filtered.archViolations).toEqual([
      expect.objectContaining({
        file: "src/orders/service.ts",
        symbol_id: service.id,
      }),
    ]);
  });

  it("builds serializable diff metadata", () => {
    const symbol = makeSymbol({
      id: "symbol",
      name: "createOrder",
      kind: "function",
      file: "src/orders.ts",
    });

    const metadata = buildDiffSiteMetadata({
      base: "master",
      head: "HEAD",
      range: "merge-base",
      changedFiles: ["src/orders.ts"],
      impacts: [makeImpact(symbol)],
      docUpdates: [
        {
          docPath: "docs/orders.md",
          symbolName: "createOrder",
          action: "updated",
          diff: "+ docs",
          structuredDiff: {
            hunks: [],
            addedLines: 0,
            removedLines: 0,
          },
        },
      ],
      docGuard: {
        passed: true,
        totalChanges: 1,
        coveredChanges: 1,
        uncoveredChanges: [],
      },
    });

    expect(metadata.base).toBe("master");
    expect(metadata.range).toBe("merge-base");
    expect(metadata.impacts[0]).toMatchObject({
      symbolId: "symbol",
      symbolName: "createOrder",
      changeType: "signature_changed",
      structuredDiff: expect.objectContaining({ addedLines: 1 }),
    });
    expect(metadata.docUpdates[0]).toMatchObject({
      docPath: "docs/orders.md",
      action: "updated",
      structuredDiff: expect.objectContaining({ addedLines: 0 }),
    });
    expect(metadata.previews[0]).toMatchObject({
      symbolId: "symbol",
      symbolName: "createOrder",
      file: "src/orders.ts",
      changeType: "signature_changed",
      docUpdateRequired: true,
      codeDiff: "+ changed",
      structuredDiff: expect.objectContaining({ addedLines: 1 }),
      docUpdates: [
        expect.objectContaining({
          docPath: "docs/orders.md",
          action: "updated",
          diff: "+ docs",
        }),
      ],
    });
  });
});
