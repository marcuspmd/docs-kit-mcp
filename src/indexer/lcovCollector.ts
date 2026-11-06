import lcovParse from "lcov-parse";
import fs from "node:fs/promises";
import path from "node:path";
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
    if (lcovPath.toLowerCase().endsWith(".xml")) {
      return parseCoberturaXml(await fs.readFile(lcovPath, "utf8"));
    }
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

/**
 * Parse a Cobertura XML report (e.g. Python coverage.xml, JaCoCo-converted)
 * into the same per-file structure produced for lcov.
 */
export function parseCoberturaXml(xml: string): LcovFileData[] {
  const attr = (tag: string, name: string): string | undefined =>
    new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1];

  // Cobertura filenames are relative to <source>; prefix a relative source root
  // (e.g. "src") so they match project-relative symbol paths.
  const sources = [...xml.matchAll(/<source>([^<]*)<\/source>/g)]
    .map((m) => m[1].trim())
    .filter((s) => s && !path.isAbsolute(s) && s !== ".");
  const sourcePrefix = sources.length === 1 ? sources[0].replace(/\/+$/, "") + "/" : "";

  const byFile = new Map<string, LcovFileData>();
  const classRe = /<class\b[^>]*>([\s\S]*?)<\/class>/g;
  let classMatch: RegExpExecArray | null;

  while ((classMatch = classRe.exec(xml)) !== null) {
    const openTag = classMatch[0].slice(0, classMatch[0].indexOf(">") + 1);
    const rawFilename = attr(openTag, "filename");
    if (!rawFilename) continue;
    const filename = path.isAbsolute(rawFilename) ? rawFilename : sourcePrefix + rawFilename;

    let entry = byFile.get(filename);
    if (!entry) {
      entry = { file: filename, functions: [], lines: new Map(), branches: { found: 0, hit: 0 } };
      byFile.set(filename, entry);
    }

    const body = classMatch[1];
    const methodRe = /<method\b[^>]*>[\s\S]*?<\/method>/g;
    let m: RegExpExecArray | null;
    while ((m = methodRe.exec(body)) !== null) {
      const tag = m[0].slice(0, m[0].indexOf(">") + 1);
      const firstLine = /<line\b[^>]*>/.exec(m[0])?.[0];
      entry.functions.push({
        name: attr(tag, "name") ?? "",
        line: Number(firstLine ? attr(firstLine, "number") : 0) || 0,
        hitCount: Number(firstLine ? attr(firstLine, "hits") : 0) || 0,
      });
    }

    const lineRe = /<line\b[^>]*>/g;
    let l: RegExpExecArray | null;
    while ((l = lineRe.exec(body)) !== null) {
      const num = Number(attr(l[0], "number"));
      const hits = Number(attr(l[0], "hits") ?? 0);
      if (!Number.isFinite(num)) continue;
      entry.lines.set(num, Math.max(entry.lines.get(num) ?? 0, hits));
    }
  }

  return [...byFile.values()];
}

/* ================== Path Normalization ================== */

/**
 * Normalize file paths for consistent comparison.
 * Handles:
 * - Leading ./
 * - Absolute paths converted to relative (when projectRoot provided)
 * - Backslashes converted to forward slashes
 */
export function normalizePath(filePath: string, projectRoot?: string): string {
  // Remove leading ./
  let normalized = filePath.replace(/^\.\//, "");

  // Convert absolute paths to relative if projectRoot is provided
  if (path.isAbsolute(normalized) && projectRoot) {
    const root = path.resolve(projectRoot);
    if (normalized.startsWith(root)) {
      normalized = normalized.slice(root.length).replace(/^[/\\]/, "");
    }
  }

  // Normalize path separators to forward slashes
  return normalized.replace(/\\/g, "/");
}

/* ================== Coverage Enrichment ================== */

/** Fallback match when one path is a suffix of the other (e.g. container/absolute roots). */
function findBySuffix(byFile: Map<string, LcovFileData>, file: string): LcovFileData | undefined {
  for (const [key, data] of byFile) {
    if (key.endsWith("/" + file) || file.endsWith("/" + key)) return data;
  }
  return undefined;
}

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
 *
 * @param symbols - Array of code symbols to enrich
 * @param coverageData - Parsed lcov coverage data
 * @param projectRoot - Optional project root for normalizing absolute paths
 */
export function enrichSymbolsWithCoverage(
  symbols: CodeSymbol[],
  coverageData: LcovFileData[],
  projectRoot?: string,
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
    const normalizedPath = normalizePath(data.file, projectRoot);
    coverageByFile.set(normalizedPath, data);
  });

  const enrichedSymbols = symbols.map((symbol) => {
    // Normalize symbol file path using the same function
    const normalizedFile = normalizePath(symbol.file, projectRoot);
    const lcovFile =
      coverageByFile.get(normalizedFile) ?? findBySuffix(coverageByFile, normalizedFile);

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
