import { describe, it, expect, beforeEach } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { parseLcov, enrichSymbolsWithCoverage } from "../src/indexer/lcovCollector.js";
import type { CodeSymbol } from "../src/indexer/symbol.types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("lcovCollector", () => {
  const fixturesDir = path.join(__dirname, "fixtures");
  const mockLcovPath = path.join(fixturesDir, "test.lcov");

  beforeEach(() => {
    // Create fixtures directory if it doesn't exist
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }

    // Create a mock lcov file
    const mockLcov = `TN:
SF:src/example.ts
FN:5,greet
FN:10,calculate
FN:20,(anonymous_0)
FNF:3
FNH:3
FNDA:12,greet
FNDA:8,calculate
FNDA:3,(anonymous_0)
DA:5,12
DA:6,12
DA:7,12
DA:8,12
DA:10,8
DA:11,8
DA:12,5
DA:13,3
DA:15,8
DA:20,3
DA:21,3
DA:22,0
LF:12
LH:11
BRDA:12,0,0,5
BRDA:12,0,1,3
BRF:2
BRH:2
end_of_record
`;

    fs.writeFileSync(mockLcovPath, mockLcov, "utf-8");
  });

  describe("parseLcov", () => {
    it("should parse a valid lcov file", async () => {
      const result = await parseLcov(mockLcovPath);

      expect(result).toHaveLength(1);
      expect(result[0].file).toBe("src/example.ts");
      expect(result[0].functions).toHaveLength(3);
      expect(result[0].branches.found).toBe(2);
      expect(result[0].branches.hit).toBe(2);
    });

    it("should extract function data correctly", async () => {
      const result = await parseLcov(mockLcovPath);
      const functions = result[0].functions;

      expect(functions[0].name).toBe("greet");
      expect(functions[0].line).toBe(5);
      expect(functions[0].hitCount).toBe(12);

      expect(functions[1].name).toBe("calculate");
      expect(functions[1].line).toBe(10);
      expect(functions[1].hitCount).toBe(8);

      expect(functions[2].name).toBe("(anonymous_0)");
      expect(functions[2].line).toBe(20);
      expect(functions[2].hitCount).toBe(3);
    });

    it("should extract line coverage data", async () => {
      const result = await parseLcov(mockLcovPath);
      const lines = result[0].lines;

      expect(lines.get(5)).toBe(12);
      expect(lines.get(10)).toBe(8);
      expect(lines.get(22)).toBe(0); // uncovered line
    });

    it("should return empty array for non-existent file", async () => {
      const result = await parseLcov("/non/existent/path.lcov");

      expect(result).toEqual([]);
    });

    it("should handle malformed lcov gracefully", async () => {
      const badLcovPath = path.join(fixturesDir, "bad.lcov");
      fs.writeFileSync(badLcovPath, "THIS IS NOT VALID LCOV", "utf-8");

      const result = await parseLcov(badLcovPath);

      // Should return empty array or minimal data, not throw
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("enrichSymbolsWithCoverage", () => {
    it("should enrich symbols with coverage data", async () => {
      const coverageData = await parseLcov(mockLcovPath);

      const symbols: CodeSymbol[] = [
        {
          id: "1",
          name: "greet",
          kind: "function",
          file: "src/example.ts",
          startLine: 5,
          endLine: 8,
        },
        {
          id: "2",
          name: "calculate",
          kind: "function",
          file: "src/example.ts",
          startLine: 10,
          endLine: 15,
        },
      ];

      const { enrichedSymbols, stats } = enrichSymbolsWithCoverage(symbols, coverageData);

      expect(stats.totalSymbols).toBe(2);
      expect(stats.symbolsEnriched).toBe(2);
      expect(stats.filesProcessed).toBe(1);

      // Check greet function
      const greet = enrichedSymbols.find((s) => s.name === "greet");
      expect(greet?.metrics?.testCoverage).toBeDefined();
      expect(greet?.metrics?.testCoverage?.hitCount).toBe(12);
      expect(greet?.metrics?.testCoverage?.coveragePercent).toBe(100); // All 4 lines covered

      // Check calculate function
      const calculate = enrichedSymbols.find((s) => s.name === "calculate");
      expect(calculate?.metrics?.testCoverage).toBeDefined();
      expect(calculate?.metrics?.testCoverage?.hitCount).toBe(8);
      // Lines 10, 11, 12, 13, 15 = 5 lines, all hit
      expect(calculate?.metrics?.testCoverage?.linesHit).toBe(5);
      expect(calculate?.metrics?.testCoverage?.linesCovered).toBe(5);
    });

    it("should match anonymous functions by line", async () => {
      const coverageData = await parseLcov(mockLcovPath);

      const symbols: CodeSymbol[] = [
        {
          id: "3",
          name: "anonymousCallback",
          kind: "lambda",
          file: "src/example.ts",
          startLine: 20,
          endLine: 22,
        },
      ];

      const { enrichedSymbols } = enrichSymbolsWithCoverage(symbols, coverageData);

      const lambda = enrichedSymbols[0];
      expect(lambda.metrics?.testCoverage).toBeDefined();
      expect(lambda.metrics?.testCoverage?.hitCount).toBe(3);
      // Lines 20, 21 are covered, line 22 is not (hit count 0)
      expect(lambda.metrics?.testCoverage?.linesHit).toBe(2);
      expect(lambda.metrics?.testCoverage?.linesCovered).toBe(3);
      expect(lambda.metrics?.testCoverage?.coveragePercent).toBeCloseTo(66.67, 1);
    });

    it("should handle symbols without coverage data", async () => {
      const coverageData = await parseLcov(mockLcovPath);

      const symbols: CodeSymbol[] = [
        {
          id: "4",
          name: "uncoveredFunction",
          kind: "function",
          file: "src/other.ts", // Different file
          startLine: 1,
          endLine: 5,
        },
      ];

      const { enrichedSymbols, stats } = enrichSymbolsWithCoverage(symbols, coverageData);

      expect(stats.symbolsEnriched).toBe(0);
      expect(enrichedSymbols[0].metrics?.testCoverage).toBeUndefined();
    });

    it("should handle empty coverage data", () => {
      const symbols: CodeSymbol[] = [
        {
          id: "5",
          name: "someFunction",
          kind: "function",
          file: "src/example.ts",
          startLine: 5,
          endLine: 8,
        },
      ];

      const { enrichedSymbols, stats } = enrichSymbolsWithCoverage(symbols, []);

      expect(stats.symbolsEnriched).toBe(0);
      expect(enrichedSymbols[0].metrics?.testCoverage).toBeUndefined();
    });

    it("should normalize file paths correctly", async () => {
      const coverageData = await parseLcov(mockLcovPath);

      // Symbol with leading ./
      const symbols: CodeSymbol[] = [
        {
          id: "6",
          name: "greet",
          kind: "function",
          file: "./src/example.ts",
          startLine: 5,
          endLine: 8,
        },
      ];

      const { enrichedSymbols, stats } = enrichSymbolsWithCoverage(symbols, coverageData);

      expect(stats.symbolsEnriched).toBe(1);
      expect(enrichedSymbols[0].metrics?.testCoverage).toBeDefined();
    });

    it("should calculate 0% coverage for symbols with no hit lines", async () => {
      // Create lcov with uncovered function
      const uncoveredLcovPath = path.join(fixturesDir, "uncovered.lcov");
      const uncoveredLcov = `TN:
SF:src/uncovered.ts
FN:5,neverCalled
FNF:1
FNH:0
FNDA:0,neverCalled
DA:5,0
DA:6,0
DA:7,0
LF:3
LH:0
end_of_record
`;
      fs.writeFileSync(uncoveredLcovPath, uncoveredLcov, "utf-8");

      const coverageData = await parseLcov(uncoveredLcovPath);
      const symbols: CodeSymbol[] = [
        {
          id: "7",
          name: "neverCalled",
          kind: "function",
          file: "src/uncovered.ts",
          startLine: 5,
          endLine: 7,
        },
      ];

      const { enrichedSymbols } = enrichSymbolsWithCoverage(symbols, coverageData);

      const func = enrichedSymbols[0];
      expect(func.metrics?.testCoverage?.hitCount).toBe(0);
      expect(func.metrics?.testCoverage?.linesHit).toBe(0);
      expect(func.metrics?.testCoverage?.linesCovered).toBe(3);
      expect(func.metrics?.testCoverage?.coveragePercent).toBe(0);
    });

    it("should preserve existing metrics when enriching", async () => {
      const coverageData = await parseLcov(mockLcovPath);

      const symbols: CodeSymbol[] = [
        {
          id: "8",
          name: "greet",
          kind: "function",
          file: "src/example.ts",
          startLine: 5,
          endLine: 8,
          metrics: {
            linesOfCode: 4,
            cyclomaticComplexity: 2,
            parameterCount: 1,
          },
        },
      ];

      const { enrichedSymbols } = enrichSymbolsWithCoverage(symbols, coverageData);

      const greet = enrichedSymbols[0];
      expect(greet.metrics?.linesOfCode).toBe(4);
      expect(greet.metrics?.cyclomaticComplexity).toBe(2);
      expect(greet.metrics?.parameterCount).toBe(1);
      expect(greet.metrics?.testCoverage).toBeDefined();
      expect(greet.metrics?.testCoverage?.coveragePercent).toBe(100);
    });
  });
});
