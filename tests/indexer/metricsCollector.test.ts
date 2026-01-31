import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { indexFile } from "../../src/indexer/indexer.js";
import { collectMetrics } from "../../src/indexer/metricsCollector.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, "fixtures");

function parseFixtureWithTree(name: string) {
  const parser = new Parser();
  parser.setLanguage(TypeScript.typescript);
  const source = readFileSync(resolve(FIXTURES, name), "utf-8");
  const symbols = indexFile(name, source, parser);
  const tree = parser.parse(source);
  return { symbols, tree };
}

describe("collectMetrics", () => {
  it("computes linesOfCode for each symbol", () => {
    const { symbols, tree } = parseFixtureWithTree("class-with-methods.ts");
    const trees = new Map([["class-with-methods.ts", tree]]);

    const result = collectMetrics({ symbols, trees });

    const cls = result.find((s) => s.name === "UserService");
    expect(cls).toBeDefined();
    expect(cls!.metrics).toBeDefined();
    expect(cls!.metrics!.linesOfCode).toBe(16); // lines 2-17

    const findById = result.find((s) => s.name === "findById");
    expect(findById).toBeDefined();
    expect(findById!.metrics!.linesOfCode).toBeGreaterThanOrEqual(2);
  });

  it("computes parameterCount from signature", () => {
    const { symbols, tree } = parseFixtureWithTree("class-with-methods.ts");
    const trees = new Map([["class-with-methods.ts", tree]]);

    const result = collectMetrics({ symbols, trees });

    const findById = result.find((s) => s.name === "findById");
    expect(findById!.metrics!.parameterCount).toBe(1); // id: string

    const create = result.find((s) => s.name === "create");
    expect(create!.metrics!.parameterCount).toBe(1); // data: CreateUserDto
  });

  it("computes cyclomaticComplexity (base 1 for simple methods)", () => {
    const { symbols, tree } = parseFixtureWithTree("class-with-methods.ts");
    const trees = new Map([["class-with-methods.ts", tree]]);

    const result = collectMetrics({ symbols, trees });

    // Simple methods with no branches should have complexity 1
    const findById = result.find((s) => s.name === "findById");
    expect(findById!.metrics!.cyclomaticComplexity).toBe(1);
  });

  it("returns metrics for all symbols", () => {
    const { symbols, tree } = parseFixtureWithTree("standalone-functions.ts");
    const trees = new Map([["standalone-functions.ts", tree]]);

    const result = collectMetrics({ symbols, trees });

    for (const s of result) {
      expect(s.metrics).toBeDefined();
      expect(s.metrics!.linesOfCode).toBeGreaterThan(0);
      expect(s.metrics!.cyclomaticComplexity).toBeGreaterThanOrEqual(1);
      expect(s.metrics!.parameterCount).toBeGreaterThanOrEqual(0);
    }
  });

  it("handles files not in the tree map gracefully", () => {
    const { symbols } = parseFixtureWithTree("class-with-methods.ts");
    const trees = new Map<string, Parser.Tree>(); // empty

    const result = collectMetrics({ symbols, trees });

    // Should still compute LOC and params, complexity defaults to 1
    for (const s of result) {
      expect(s.metrics).toBeDefined();
      expect(s.metrics!.cyclomaticComplexity).toBe(1);
    }
  });
});
