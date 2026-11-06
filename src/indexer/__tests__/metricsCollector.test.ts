import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import PHP from "tree-sitter-php";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { indexFile } from "../indexer.js";
import { collectMetrics } from "../metricsCollector.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, "fixtures");
const PHP_LANGUAGE = (PHP as { php?: unknown }).php ?? PHP;

/**
 * Create a fresh parser for each test to avoid state corruption issues
 * with tree-sitter in Jest test environment.
 */
function createFreshParser(language: unknown = TypeScript.typescript): Parser {
  const parser = new Parser();
  (parser as { setLanguage: (language: unknown) => void }).setLanguage(language);
  return parser;
}

function parseFixtureWithTree(name: string) {
  const source = readFileSync(resolve(FIXTURES, name), "utf-8");

  // Use completely separate parsers for tree and symbols extraction
  const treeParser = createFreshParser();
  const tree = treeParser.parse(source);

  const symbolParser = createFreshParser();
  const symbols = indexFile(name, source, symbolParser);

  return { symbols, tree };
}

function parseSourceWithTree(fileName: string, source: string, language: unknown) {
  const treeParser = createFreshParser(language);
  const tree = treeParser.parse(source);

  const symbolParser = new Parser();
  const symbols = indexFile(fileName, source, symbolParser);

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
    expect(cls!.metrics!.linesOfCode).toBe(12); // lines 2-17 minus blank lines

    const findById = result.find((s) => s.name === "findById");
    expect(findById).toBeDefined();
    expect(findById!.metrics!.linesOfCode).toBeGreaterThanOrEqual(2);
  });

  it("excludes comments and blank lines from linesOfCode", () => {
    const source = [
      "export function sum(a: number, b: number): number {",
      "  // line comment",
      "",
      "  /**",
      "   * block comment",
      "   */",
      "  const r = a + b; // trailing comment keeps the line",
      "  return r;",
      "}",
      "",
    ].join("\n");
    const { symbols, tree } = parseSourceWithTree("sum.ts", source, TypeScript.typescript);
    const result = collectMetrics({ symbols, trees: new Map([["sum.ts", tree]]) });
    const fn = result.find((s) => s.name === "sum");
    expect(fn!.metrics!.linesOfCode).toBe(4);
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
    expect(findById!.metrics!.cognitiveComplexity).toBe(0);
    expect(findById!.metrics!.maxNestingDepth).toBe(0);
  });

  it("computes cognitive complexity and max nesting depth", () => {
    const { symbols, tree } = parseFixtureWithTree("complexity.ts");
    const trees = new Map([["complexity.ts", tree]]);

    const result = collectMetrics({ symbols, trees });

    const classify = result.find((s) => s.name === "classify");
    expect(classify).toBeDefined();
    expect(classify!.metrics!.cyclomaticComplexity).toBe(6);
    expect(classify!.metrics!.cognitiveComplexity).toBe(8);
    expect(classify!.metrics!.maxNestingDepth).toBe(3);
  });

  it("computes PHP cyclomatic complexity without counting null coalescing as a branch", () => {
    const fileName = "MarginAggregationAdapter.php";
    const source = `<?php
  class MarginAggregationAdapter
  {
    public function buildResponse($apiResponse): Response
    {
      if ($apiResponse->status() != 200) {
        return new Response(false);
      }

      $payload = $apiResponse->json();

      if ($payload['success'] ?? false) {
        return new Response(true);
      }

      $errors = $payload['errors'] ?? [];
      $values = [];

      foreach ($errors as $error) {
        if (isset($error['value'])) {
          $values[] = $error['value'];
        }
      }

      if ($values) {
        return new Response(false, $values);
      }

      return new Response(false);
    }
  }
  `;
    const { symbols, tree } = parseSourceWithTree(fileName, source, PHP_LANGUAGE);
    const trees = new Map([[fileName, tree]]);

    const result = collectMetrics({ symbols, trees });

    const buildResponse = result.find((symbol) => symbol.name === "buildResponse");
    expect(buildResponse).toBeDefined();
    expect(buildResponse!.metrics!.cyclomaticComplexity).toBe(6);
  });

  it("returns metrics for all symbols", () => {
    const { symbols, tree } = parseFixtureWithTree("standalone-functions.ts");
    const trees = new Map([["standalone-functions.ts", tree]]);

    const result = collectMetrics({ symbols, trees });

    for (const s of result) {
      expect(s.metrics).toBeDefined();
      expect(s.metrics!.linesOfCode).toBeGreaterThan(0);
      expect(s.metrics!.cyclomaticComplexity).toBeGreaterThanOrEqual(1);
      expect(s.metrics!.cognitiveComplexity).toBeGreaterThanOrEqual(0);
      expect(s.metrics!.maxNestingDepth).toBeGreaterThanOrEqual(0);
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
      expect(s.metrics!.cognitiveComplexity).toBe(0);
      expect(s.metrics!.maxNestingDepth).toBe(0);
    }
  });
});
