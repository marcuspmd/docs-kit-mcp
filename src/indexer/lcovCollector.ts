import lcovParse from "lcov-parse";
import { promisify } from "node:util";
import type { CodeSymbol } from "./symbol.types.js";

const parseLcovFile = promisify(lcovParse);

/* ================== Types ================== */

export interface LcovFunctionData {
  name: string;
  line: number;
  hitCount: number;
}

export interface LcovFileData {
  file: string;
  functions: LcovFunctionData[];
  lines: Map<number, number>; // line number -> hit count
  branches: {
    found: number;
    hit: number;
  };
}

export interface CoverageEnrichmentStats {
  totalSymbols: number;
  symbolsEnriched: number;
  symbolsWithoutMatch: number;
  filesProcessed: number;
}

interface LcovParsedRecord {
  file: string;
  functions?: {
    found: number;
    hit: number;
    details: Array<{ name: string; line: number; hit: number }>;
  };
  lines?: {
    found: number;
    hit: number;
    details: Array<{ line: number; hit: number }>;
  };
  branches?: {
    found: number;
    hit: number;
  };
}

/* ================== Parser ================== */

/**
 * Parse lcov.info file and extract coverage data per file.
 * Returns empty array if file doesn't exist or parsing fails.
 */
export async function parseLcov(lcovPath: string): Promise<LcovFileData[]> {
  try {
    const parsedData = (await parseLcovFile(lcovPath)) as LcovParsedRecord[];

    return parsedData.map((record: LcovParsedRecord) => {
      const functions: LcovFunctionData[] = (record.functions?.details || []).map(
        (fn: { name: string; line: number; hit: number }) => ({
          name: fn.name,
          line: fn.line,
          hitCount: fn.hit,
        }),
      );

      const lines = new Map<number, number>();
      (record.lines?.details || []).forEach((line: { line: number; hit: number }) => {
        lines.set(line.line, line.hit);
      });

      return {
        file: record.file,
        functions,
        lines,
        branches: {
          found: record.branches?.found || 0,
          hit: record.branches?.hit || 0,
        },
      };
    });
  } catch (error) {
    console.warn(`Failed to parse lcov file at ${lcovPath}:`, error);
    return [];
  }
}

/* ================== Coverage Enrichment ================== */

/**
 * Calculate coverage metrics for a symbol based on lcov line data.
 */
function calculateSymbolCoverage(
  symbol: CodeSymbol,
  lcovFile: LcovFileData,
): NonNullable<CodeSymbol["metrics"]>["testCoverage"] | undefined {
  const { startLine, endLine } = symbol;
  const linesCovered: number[] = [];
  const linesHit: number[] = [];

  // Count lines within symbol range
  for (let line = startLine; line <= endLine; line++) {
    const hitCount = lcovFile.lines.get(line);
    if (hitCount !== undefined) {
      linesCovered.push(line);
      if (hitCount > 0) {
        linesHit.push(line);
      }
    }
  }

  // If no coverage data for this symbol's lines, skip
  if (linesCovered.length === 0) {
    return undefined;
  }

  const coveragePercent = (linesHit.length / linesCovered.length) * 100;

  // Find function hit count if available
  const matchingFn = lcovFile.functions.find((fn) => fn.line === startLine);
  const hitCount = matchingFn?.hitCount || 0;

  return {
    hitCount,
    linesHit: linesHit.length,
    linesCovered: linesCovered.length,
    coveragePercent,
    // Branch coverage could be calculated here if needed - for now omit
  };
}

/**
 * Enrich symbols with test coverage data from lcov.
 * Returns new array with coverage metrics added to matching symbols.
 */
export function enrichSymbolsWithCoverage(
  symbols: CodeSymbol[],
  coverageData: LcovFileData[],
): { enrichedSymbols: CodeSymbol[]; stats: CoverageEnrichmentStats } {
  const stats: CoverageEnrichmentStats = {
    totalSymbols: symbols.length,
    symbolsEnriched: 0,
    symbolsWithoutMatch: 0,
    filesProcessed: coverageData.length,
  };

  // Build file -> coverage map for fast lookup
  const coverageByFile = new Map<string, LcovFileData>();
  coverageData.forEach((data) => {
    // Normalize file paths (remove leading ./)
    const normalizedPath = data.file.replace(/^\.\//, "");
    coverageByFile.set(normalizedPath, data);
  });

  const enrichedSymbols = symbols.map((symbol) => {
    // Normalize symbol file path
    const normalizedFile = symbol.file.replace(/^\.\//, "");
    const lcovFile = coverageByFile.get(normalizedFile);

    if (!lcovFile) {
      return symbol;
    }

    // Calculate coverage for this symbol
    const testCoverage = calculateSymbolCoverage(symbol, lcovFile);

    if (!testCoverage) {
      return symbol;
    }

    stats.symbolsEnriched++;

    // Return symbol with enriched metrics
    return {
      ...symbol,
      metrics: {
        ...symbol.metrics,
        testCoverage,
      },
    };
  });

  stats.symbolsWithoutMatch = stats.totalSymbols - stats.symbolsEnriched;

  return { enrichedSymbols, stats };
}
