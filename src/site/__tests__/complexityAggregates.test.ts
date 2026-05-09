import type { CodeSymbol } from "../../indexer/symbol.types.js";
import { buildComplexityModel } from "../complexityAggregates.js";

function makeSymbol(
  overrides: Partial<CodeSymbol> & Pick<CodeSymbol, "id" | "name" | "kind" | "file">,
): CodeSymbol {
  return {
    startLine: 1,
    endLine: 10,
    ...overrides,
  };
}

describe("buildComplexityModel", () => {
  it("aggregates complexity by symbol, class, and module", () => {
    const symbols: CodeSymbol[] = [
      makeSymbol({
        id: "class:OrderService",
        name: "OrderService",
        kind: "class",
        file: "src/orders/service.ts",
        endLine: 80,
        metrics: {
          linesOfCode: 80,
          cyclomaticComplexity: 4,
          cognitiveComplexity: 5,
          maxNestingDepth: 2,
          parameterCount: 0,
        },
      }),
      makeSymbol({
        id: "method:validate",
        name: "validate",
        kind: "method",
        file: "src/orders/service.ts",
        parent: "class:OrderService",
        startLine: 10,
        endLine: 40,
        metrics: {
          linesOfCode: 30,
          cyclomaticComplexity: 12,
          cognitiveComplexity: 20,
          maxNestingDepth: 5,
          parameterCount: 1,
        },
      }),
      makeSymbol({
        id: "function:normalize",
        name: "normalizeOrder",
        kind: "function",
        file: "src/orders/helpers.ts",
        metrics: {
          linesOfCode: 10,
          cyclomaticComplexity: 2,
          cognitiveComplexity: 3,
          maxNestingDepth: 1,
          parameterCount: 1,
        },
      }),
      makeSymbol({
        id: "interface:Order",
        name: "Order",
        kind: "interface",
        file: "src/contracts/order.ts",
        metrics: {
          linesOfCode: 5,
          cyclomaticComplexity: 0,
          cognitiveComplexity: 0,
          maxNestingDepth: 0,
          parameterCount: 0,
        },
      }),
    ];

    const model = buildComplexityModel(symbols, [
      "src/orders/service.ts",
      "src/orders/helpers.ts",
      "src/contracts/order.ts",
    ]);

    expect(model.project.fileCount).toBe(3);
    expect(model.project.classCount).toBe(1);
    expect(model.project.functionCount).toBe(2);
    expect(model.project.highComplexitySymbolCount).toBe(1);

    const validateEntry = model.symbols.find((entry) => entry.id === "method:validate");
    expect(validateEntry?.aboveThresholds).toEqual([
      "cyclomaticComplexity",
      "cognitiveComplexity",
      "maxNestingDepth",
    ]);
    expect(model.topSymbols[0].id).toBe("method:validate");

    const classAggregate = model.classes.find((entry) => entry.id === "class:OrderService");
    expect(classAggregate?.memberCount).toBe(1);
    expect(classAggregate?.symbolIds).toEqual(["class:OrderService", "method:validate"]);
    expect(classAggregate?.maxCognitiveComplexity).toBe(20);

    const ordersModule = model.modules.find((entry) => entry.path === "src/orders");
    expect(ordersModule?.fileCount).toBe(2);
    expect(ordersModule?.symbolCount).toBe(3);
    expect(ordersModule?.classCount).toBe(1);
    expect(ordersModule?.functionCount).toBe(2);
    expect(ordersModule?.hotspotSymbolIds[0]).toBe("method:validate");
  });
});
