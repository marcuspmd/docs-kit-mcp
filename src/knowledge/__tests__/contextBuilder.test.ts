import { jest } from "@jest/globals";
import { buildRelevantContext } from "../contextBuilder.js";
import type { BuildRelevantContextDeps } from "../contextBuilder.js";
import type { CodeSymbol } from "../../indexer/symbol.types.js";

const makeSymbol = (overrides?: Partial<CodeSymbol>): CodeSymbol =>
  ({
    id: "sym1",
    name: "createOrder",
    qualifiedName: "orders.createOrder",
    kind: "function",
    file: "src/orders.ts",
    startLine: 10,
    endLine: 25,
    language: "ts",
    signature: "(order: Order): Promise<string>",
    layer: "application",
    pattern: "service",
    summary: "Creates an order",
    ...overrides,
  }) as CodeSymbol;

const makeDeps = (overrides?: Partial<BuildRelevantContextDeps>): BuildRelevantContextDeps => ({
  projectRoot: "/project",
  docsDir: "/project/docs",
  registry: {
    findDocBySymbol: jest.fn<() => Promise<[]>>().mockResolvedValue([]),
  } as unknown as BuildRelevantContextDeps["registry"],
  symbolRepo: {
    findByName: jest.fn<() => CodeSymbol[]>().mockReturnValue([makeSymbol()]),
    findByFile: jest.fn<() => CodeSymbol[]>().mockReturnValue([]),
    findByIds: jest.fn<() => CodeSymbol[]>().mockReturnValue([]),
  } as unknown as BuildRelevantContextDeps["symbolRepo"],
  graph: {
    getDependencies: jest.fn<() => []>().mockReturnValue([]),
    getDependents: jest.fn<() => []>().mockReturnValue([]),
  } as unknown as BuildRelevantContextDeps["graph"],
  ...overrides,
});

describe("buildRelevantContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns not-found result when no symbols matched", async () => {
    const deps = makeDeps({
      symbolRepo: {
        findByName: jest.fn<() => CodeSymbol[]>().mockReturnValue([]),
        findByFile: jest.fn<() => CodeSymbol[]>().mockReturnValue([]),
        findByIds: jest.fn<() => CodeSymbol[]>().mockReturnValue([]),
      } as unknown as BuildRelevantContextDeps["symbolRepo"],
    });

    const result = await buildRelevantContext({ symbolName: "nonexistent" }, deps);
    expect(result.found).toBe(false);
    expect(result.text).toContain("nonexistent");
  });

  it("returns not-found when neither symbolName nor filePath provided", async () => {
    const deps = makeDeps({
      symbolRepo: {
        findByName: jest.fn<() => CodeSymbol[]>().mockReturnValue([]),
        findByFile: jest.fn<() => CodeSymbol[]>().mockReturnValue([]),
        findByIds: jest.fn<() => CodeSymbol[]>().mockReturnValue([]),
      } as unknown as BuildRelevantContextDeps["symbolRepo"],
    });

    const result = await buildRelevantContext({}, deps);
    expect(result.found).toBe(false);
  });

  it("returns context for found symbol", async () => {
    const deps = makeDeps();
    const result = await buildRelevantContext({ symbolName: "createOrder" }, deps);

    expect(result.found).toBe(true);
    expect(result.text).toContain("createOrder");
    expect(result.text).toContain("## Symbols");
  });

  it("includes symbol metadata in context", async () => {
    const deps = makeDeps();
    const result = await buildRelevantContext({ symbolName: "createOrder" }, deps);

    expect(result.text).toContain("Kind: function");
    expect(result.text).toContain("File: src/orders.ts");
    expect(result.text).toContain("Signature:");
    expect(result.text).toContain("Layer:");
    expect(result.text).toContain("Pattern:");
    expect(result.text).toContain("Summary:");
  });

  it("uses filePath lookup when provided", async () => {
    const sym = makeSymbol({ id: "s2", name: "handler", file: "src/handler.ts" });
    const deps = makeDeps({
      symbolRepo: {
        findByName: jest.fn<() => CodeSymbol[]>().mockReturnValue([]),
        findByFile: jest.fn<() => CodeSymbol[]>().mockReturnValue([sym]),
        findByIds: jest.fn<() => CodeSymbol[]>().mockReturnValue([]),
      } as unknown as BuildRelevantContextDeps["symbolRepo"],
    });

    const result = await buildRelevantContext({ filePath: "src/handler.ts" }, deps);
    expect(result.found).toBe(true);
    expect(result.text).toContain("handler");
  });

  it("skips source section in compact mode", async () => {
    const deps = makeDeps();
    const result = await buildRelevantContext({ symbolName: "createOrder", mode: "compact" }, deps);

    expect(result.found).toBe(true);
    expect(result.text).not.toContain("## Source Code");
  });

  it("includes source section in full mode", async () => {
    // projectRoot doesn't have real file, but buildSourceSection catches file errors
    const deps = makeDeps();
    const result = await buildRelevantContext({ symbolName: "createOrder", mode: "full" }, deps);

    expect(result.found).toBe(true);
    // Source section header should be present even if file read fails
    expect(result.text).toContain("## Source Code");
  });

  it("includes dependencies section when graph returns deps", async () => {
    const depSym = makeSymbol({ id: "dep1", name: "OrderRepository", kind: "class" });
    const deps = makeDeps({
      graph: {
        getDependencies: jest.fn().mockReturnValue([{ targetId: "dep1" }]),
        getDependents: jest.fn().mockReturnValue([]),
      } as unknown as BuildRelevantContextDeps["graph"],
      symbolRepo: {
        findByName: jest.fn<() => CodeSymbol[]>().mockReturnValue([makeSymbol()]),
        findByFile: jest.fn<() => CodeSymbol[]>().mockReturnValue([]),
        findByIds: jest.fn<() => CodeSymbol[]>().mockReturnValue([depSym]),
      } as unknown as BuildRelevantContextDeps["symbolRepo"],
    });

    const result = await buildRelevantContext({ symbolName: "createOrder" }, deps);
    expect(result.text).toContain("## Dependencies");
    expect(result.text).toContain("OrderRepository");
  });

  it("includes dependents section when graph returns dependents", async () => {
    const depSym = makeSymbol({ id: "dep2", name: "OrderController", kind: "class" });
    const deps = makeDeps({
      graph: {
        getDependencies: jest.fn().mockReturnValue([]),
        getDependents: jest.fn().mockReturnValue([{ sourceId: "dep2" }]),
      } as unknown as BuildRelevantContextDeps["graph"],
      symbolRepo: {
        findByName: jest.fn<() => CodeSymbol[]>().mockReturnValue([makeSymbol()]),
        findByFile: jest.fn<() => CodeSymbol[]>().mockReturnValue([]),
        findByIds: jest.fn<() => CodeSymbol[]>().mockReturnValue([depSym]),
      } as unknown as BuildRelevantContextDeps["symbolRepo"],
    });

    const result = await buildRelevantContext({ symbolName: "createOrder" }, deps);
    expect(result.text).toContain("## Dependents");
    expect(result.text).toContain("OrderController");
  });

  it("truncates context when maxContextChars is small", async () => {
    const deps = makeDeps();
    const result = await buildRelevantContext(
      { symbolName: "createOrder", maxContextChars: 50 },
      deps,
    );

    expect(result.found).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(100); // truncated + suffix
    expect(result.text).toContain("_(context truncated)_");
  });

  it("uses custom estimateTokens when provided", async () => {
    const mockEstimate = jest.fn<(t: string) => number>().mockReturnValue(100);
    const deps = makeDeps({ estimateTokens: mockEstimate });

    await buildRelevantContext({ symbolName: "createOrder" }, deps);
    expect(mockEstimate).toHaveBeenCalled();
  });

  it("uses compact dependency labels in compact mode", async () => {
    const depSym = makeSymbol({ id: "dep1", name: "OrderRepository", kind: "class" });
    const deps = makeDeps({
      graph: {
        getDependencies: jest.fn().mockReturnValue([{ targetId: "dep1" }]),
        getDependents: jest.fn().mockReturnValue([]),
      } as unknown as BuildRelevantContextDeps["graph"],
      symbolRepo: {
        findByName: jest.fn<() => CodeSymbol[]>().mockReturnValue([makeSymbol()]),
        findByFile: jest.fn<() => CodeSymbol[]>().mockReturnValue([]),
        findByIds: jest.fn<() => CodeSymbol[]>().mockReturnValue([depSym]),
      } as unknown as BuildRelevantContextDeps["symbolRepo"],
    });

    const result = await buildRelevantContext({ symbolName: "createOrder", mode: "compact" }, deps);
    expect(result.text).toContain("OrderRepository (class)");
  });
});
