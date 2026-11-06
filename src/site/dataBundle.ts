import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { CodeSymbol } from "../indexer/symbol.types.js";
import type { DetectedPattern } from "../patterns/patternAnalyzer.js";
import type { ArchViolationRow, ReaperFindingRow, RelationshipRow } from "../storage/db.js";
import { normalizePath, parseLcov } from "../indexer/lcovCollector.js";
import { minimatch } from "../config.js";
import { buildSearchIndex, type SearchIndex } from "./searchIndex.js";
import type { DocEntry } from "./types.js";
import { buildComplexityModel, type ComplexityModel } from "./complexityAggregates.js";
import { loadSiteData, type LoadedSiteData } from "./dataLoader.js";
import type { DiffSiteMetadata } from "./diffData.js";

export const SITE_DATA_BUNDLE_SCHEMA_VERSION = 3;

export interface SiteProjectInfo {
  name: string;
  branch: string;
}

/** Map of file path -> { lineNumber -> hit count | null }. null = no coverage data. */
export type CoverageByLine = Record<string, Record<number, number | null>>;

export interface DocumentationHealth {
  documentedSymbolCount: number;
  missingDocRefCount: number;
  missingDocRefByKind: Record<string, number>;
  missingDocRefByLayer: Record<string, number>;
}

export interface CoverageHealth {
  symbolCount: number;
  coveredSymbolCount: number;
  averageCoveragePercent: number | null;
  lowCoverageSymbolCount: number;
  uncoveredSymbolCount: number;
}

export interface GovernanceHealth {
  archViolationCount: number;
  reaperFindingCount: number;
  deprecatedSymbolCount: number;
  patternCount: number;
}

export interface SiteHealthSummary {
  docs: DocumentationHealth;
  coverage: CoverageHealth;
  governance: GovernanceHealth;
}

export interface SourceFileContext {
  path: string;
  text: string;
  lineCount: number;
  language: string | null;
}

export interface SiteDataBundle {
  schemaVersion: number;
  generatedAt: string;
  project: SiteProjectInfo;
  diff?: DiffSiteMetadata;
  symbols: CodeSymbol[];
  relationships: RelationshipRow[];
  patterns: DetectedPattern[];
  files: string[];
  docs: DocEntry[];
  archViolations: ArchViolationRow[];
  reaperFindings: ReaperFindingRow[];
  sourceFiles: Record<string, SourceFileContext>;
  coverageByLine: CoverageByLine;
  search: SearchIndex;
  complexity: ComplexityModel;
  health: SiteHealthSummary;
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

function incrementCounter(counter: Record<string, number>, key: string | undefined): void {
  const normalizedKey = key && key.length > 0 ? key : "unknown";
  counter[normalizedKey] = (counter[normalizedKey] ?? 0) + 1;
}

function buildDocumentationHealth(symbols: CodeSymbol[]): DocumentationHealth {
  const missingDocRefByKind: Record<string, number> = {};
  const missingDocRefByLayer: Record<string, number> = {};
  let documentedSymbolCount = 0;
  let missingDocRefCount = 0;

  for (const symbol of symbols) {
    if (symbol.docRef) {
      documentedSymbolCount++;
      continue;
    }

    missingDocRefCount++;
    incrementCounter(missingDocRefByKind, symbol.kind);
    incrementCounter(missingDocRefByLayer, symbol.layer);
  }

  return {
    documentedSymbolCount,
    missingDocRefCount,
    missingDocRefByKind,
    missingDocRefByLayer,
  };
}

function buildCoverageHealth(symbols: CodeSymbol[]): CoverageHealth {
  const symbolsWithCoverage = symbols.filter((symbol) => symbol.metrics?.testCoverage);
  if (symbolsWithCoverage.length === 0) {
    return {
      symbolCount: symbols.length,
      coveredSymbolCount: 0,
      averageCoveragePercent: null,
      lowCoverageSymbolCount: 0,
      uncoveredSymbolCount: 0,
    };
  }

  const coverageValues = symbolsWithCoverage.map(
    (symbol) => symbol.metrics?.testCoverage?.coveragePercent ?? 0,
  );
  const totalCoverage = coverageValues.reduce((sum, coverage) => sum + coverage, 0);

  return {
    symbolCount: symbols.length,
    coveredSymbolCount: symbolsWithCoverage.length,
    averageCoveragePercent: round(totalCoverage / symbolsWithCoverage.length),
    lowCoverageSymbolCount: coverageValues.filter((coverage) => coverage > 0 && coverage < 50)
      .length,
    uncoveredSymbolCount: coverageValues.filter((coverage) => coverage === 0).length,
  };
}

function buildGovernanceHealth(data: LoadedSiteData): GovernanceHealth {
  return {
    archViolationCount: data.archViolations.length,
    reaperFindingCount: data.reaperFindings.length,
    deprecatedSymbolCount: data.symbols.filter((symbol) => symbol.deprecated).length,
    patternCount: data.patterns.length,
  };
}

function buildSiteHealth(data: LoadedSiteData): SiteHealthSummary {
  return {
    docs: buildDocumentationHealth(data.symbols),
    coverage: buildCoverageHealth(data.symbols),
    governance: buildGovernanceHealth(data),
  };
}

function languageForPath(filePath: string): string | null {
  const extension = path.extname(filePath).toLowerCase();
  const languages: Record<string, string> = {
    ".ts": "typescript",
    ".tsx": "tsx",
    ".js": "javascript",
    ".jsx": "jsx",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".json": "json",
    ".md": "markdown",
    ".py": "python",
    ".go": "go",
    ".php": "php",
    ".rb": "ruby",
    ".cs": "csharp",
  };

  return languages[extension] ?? null;
}

function buildSourceFiles(files: string[], rootDir?: string): Record<string, SourceFileContext> {
  const sourceFiles: Record<string, SourceFileContext> = {};
  const projectRoot = path.resolve(rootDir ?? process.cwd());

  for (const file of files) {
    const absolutePath = path.resolve(projectRoot, file);
    if (!absolutePath.startsWith(projectRoot)) continue;

    try {
      const text = fs.readFileSync(absolutePath, "utf-8");
      sourceFiles[file] = {
        path: file,
        text,
        lineCount: text.split("\n").length,
        language: languageForPath(file),
      };
    } catch {
      // Source is optional for generated/binary/missing files.
    }
  }

  return sourceFiles;
}

function buildProjectInfo(rootDir: string | undefined): SiteProjectInfo {
  const root = path.resolve(rootDir ?? process.cwd());
  let name = path.basename(root);
  try {
    const pkgRaw = fs.readFileSync(path.join(root, "package.json"), "utf-8");
    const pkg = JSON.parse(pkgRaw) as { name?: string };
    if (pkg.name && typeof pkg.name === "string") name = pkg.name;
  } catch {
    // optional
  }

  let branch = "main";
  try {
    branch =
      execSync("git rev-parse --abbrev-ref HEAD", {
        cwd: root,
        stdio: ["ignore", "pipe", "ignore"],
      })
        .toString()
        .trim() || branch;
  } catch {
    // optional
  }

  return { name, branch };
}

async function buildCoverageByLine(
  sourceFiles: Record<string, SourceFileContext>,
  rootDir: string | undefined,
  lcovPath: string | undefined,
  ignore: string[] = [],
): Promise<CoverageByLine> {
  if (!lcovPath) return {};
  const resolved = path.isAbsolute(lcovPath)
    ? lcovPath
    : path.resolve(rootDir ?? process.cwd(), lcovPath);
  if (!fs.existsSync(resolved)) return {};

  const projectRoot = path.resolve(rootDir ?? process.cwd());
  let records = await parseLcov(resolved);
  if (records.length === 0) return {};
  if (ignore.length > 0) {
    records = records.filter(
      (f) => !ignore.some((pattern) => minimatch(normalizePath(f.file, projectRoot), pattern)),
    );
  }

  // Build lookup: normalized path -> Map<line, hit>
  const byPath = new Map<string, Map<number, number>>();
  for (const rec of records) {
    const norm = normalizePath(rec.file, projectRoot);
    byPath.set(norm, rec.lines);
  }

  const out: CoverageByLine = {};
  for (const [filePath, ctx] of Object.entries(sourceFiles)) {
    const norm = normalizePath(filePath, projectRoot);
    const lineHits = byPath.get(norm) ?? byPath.get(filePath);
    if (!lineHits) continue;
    const lines = ctx.text.split("\n");
    const entry: Record<number, number | null> = {};
    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const hit = lineHits.get(lineNum);
      if (hit === undefined) {
        entry[lineNum] = null;
      } else {
        entry[lineNum] = hit;
      }
    }
    out[filePath] = entry;
  }
  return out;
}

export interface CreateSiteDataBundleOptions {
  diff?: DiffSiteMetadata;
  /** Path to lcov.info (relative to rootDir or absolute). Defaults to "coverage/lcov.info". */
  lcovPath?: string;
  /** Glob patterns for files to exclude from coverage metrics (e.g. "src/test-utils/**"). */
  coverageIgnore?: string[];
}

export async function createSiteDataBundle(
  data: LoadedSiteData,
  generatedAt = new Date().toISOString(),
  rootDir?: string,
  options?: CreateSiteDataBundleOptions,
): Promise<SiteDataBundle> {
  const complexity = buildComplexityModel(data.symbols, data.files);
  const sourceFiles = buildSourceFiles(data.files, rootDir);
  const lcovPath = options?.lcovPath ?? "coverage/lcov.info";
  const coverageByLine = await buildCoverageByLine(
    sourceFiles,
    rootDir,
    lcovPath,
    options?.coverageIgnore ?? [],
  );

  return {
    schemaVersion: SITE_DATA_BUNDLE_SCHEMA_VERSION,
    generatedAt,
    project: buildProjectInfo(rootDir),
    diff: options?.diff,
    symbols: data.symbols,
    relationships: data.relationships,
    patterns: data.patterns,
    files: data.files,
    docs: data.docEntries,
    archViolations: data.archViolations,
    reaperFindings: data.reaperFindings,
    sourceFiles,
    coverageByLine,
    search: buildSearchIndex(data.symbols),
    complexity,
    health: buildSiteHealth(data),
  };
}
