import type { CodeSymbol } from "../../indexer/symbol.types.js";
import type { LoadedSiteData } from "../dataLoader.js";
import { createSiteDataBundle, SITE_DATA_BUNDLE_SCHEMA_VERSION } from "../dataBundle.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function makeSymbol(
  overrides: Partial<CodeSymbol> & Pick<CodeSymbol, "id" | "name" | "kind" | "file">,
): CodeSymbol {
  return {
    startLine: 1,
    endLine: 10,
    ...overrides,
  };
}

describe("createSiteDataBundle", () => {
  it("builds complexity, search, and health summaries for the v2 site", () => {
    const documentedSymbol = makeSymbol({
      id: "class:OrderService",
      name: "OrderService",
      kind: "class",
      file: "src/orders/service.ts",
      docRef: "docs/orders.md",
      layer: "application",
      deprecated: true,
      metrics: {
        linesOfCode: 30,
        cyclomaticComplexity: 4,
        cognitiveComplexity: 6,
        maxNestingDepth: 2,
        parameterCount: 0,
        testCoverage: {
          hitCount: 10,
          linesHit: 9,
          linesCovered: 12,
          coveragePercent: 75,
        },
      },
    });
    const missingDocsSymbol = makeSymbol({
      id: "function:validateOrder",
      name: "validateOrder",
      kind: "function",
      file: "src/orders/validate.ts",
      layer: "domain",
      metrics: {
        linesOfCode: 20,
        cyclomaticComplexity: 11,
        cognitiveComplexity: 18,
        maxNestingDepth: 5,
        parameterCount: 1,
      },
    });

    const data: LoadedSiteData = {
      symbols: [documentedSymbol, missingDocsSymbol],
      relationships: [
        { source_id: documentedSymbol.id, target_id: missingDocsSymbol.id, type: "uses" },
      ],
      patterns: [
        {
          kind: "repository",
          symbols: [documentedSymbol.id],
          confidence: 0.9,
          violations: [],
        },
      ],
      files: ["src/orders/service.ts", "src/orders/validate.ts"],
      archViolations: [
        {
          rule: "layer-boundary",
          file: "src/orders/validate.ts",
          symbol_id: missingDocsSymbol.id,
          message: "Invalid dependency",
          severity: "error",
        },
      ],
      reaperFindings: [
        {
          type: "dead_code",
          target: "src/orders/legacy.ts",
          reason: "No references",
          suggested_action: "remove",
        },
      ],
      docEntries: [{ path: "docs/orders.md", title: "Orders" }],
      docsConfigDir: null,
    };

    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "docs-kit-site-bundle-"));
    fs.mkdirSync(path.join(rootDir, "src/orders"), { recursive: true });
    fs.writeFileSync(
      path.join(rootDir, "src/orders/service.ts"),
      "export class OrderService {\n  validate() {\n    return true;\n  }\n}\n",
    );
    fs.writeFileSync(
      path.join(rootDir, "src/orders/validate.ts"),
      "export function validateOrder() {\n  return true;\n}\n",
    );

    const bundle = createSiteDataBundle(data, "2026-01-01T00:00:00.000Z", rootDir);

    expect(bundle.schemaVersion).toBe(SITE_DATA_BUNDLE_SCHEMA_VERSION);
    expect(bundle.generatedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(bundle.symbols).toHaveLength(2);
    expect(bundle.relationships).toHaveLength(1);
    expect(bundle.docs).toEqual(data.docEntries);
    expect(bundle.sourceFiles["src/orders/service.ts"].text).toContain("class OrderService");
    expect(bundle.sourceFiles["src/orders/service.ts"].language).toBe("typescript");
    expect(
      bundle.search.items.some((entry) => (entry as { name?: string }).name === "OrderService"),
    ).toBe(true);

    expect(bundle.complexity.project.highComplexitySymbolCount).toBe(1);
    expect(bundle.complexity.topSymbols[0].id).toBe(missingDocsSymbol.id);

    expect(bundle.health.docs.documentedSymbolCount).toBe(1);
    expect(bundle.health.docs.missingDocRefCount).toBe(1);
    expect(bundle.health.docs.missingDocRefByKind).toEqual({ function: 1 });
    expect(bundle.health.docs.missingDocRefByLayer).toEqual({ domain: 1 });
    expect(bundle.health.coverage.coveredSymbolCount).toBe(1);
    expect(bundle.health.coverage.averageCoveragePercent).toBe(75);
    expect(bundle.health.governance).toEqual({
      archViolationCount: 1,
      reaperFindingCount: 1,
      deprecatedSymbolCount: 1,
      patternCount: 1,
    });
  });
});
