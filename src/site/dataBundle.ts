import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { CodeSymbol } from "../indexer/symbol.types.js";
import type { DetectedPattern } from "../patterns/patternAnalyzer.js";
import type { ArchViolationRow, ReaperFindingRow, RelationshipRow } from "../storage/db.js";
import { buildSearchIndex } from "./templates.js";
import type { DocEntry } from "./templates/types.js";
import { buildComplexityModel, type ComplexityModel } from "./complexityAggregates.js";
import { loadSiteData, type LoadedSiteData } from "./dataLoader.js";

export const SITE_DATA_BUNDLE_SCHEMA_VERSION = 2;

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
  symbols: CodeSymbol[];
  relationships: RelationshipRow[];
  patterns: DetectedPattern[];
  files: string[];
  docs: DocEntry[];
  archViolations: ArchViolationRow[];
  reaperFindings: ReaperFindingRow[];
  sourceFiles: Record<string, SourceFileContext>;
  search: ReturnType<typeof buildSearchIndex>;
  complexity: ComplexityModel;
  health: SiteHealthSummary;
}

export interface DataBundleOptions {
  dbPath?: string;
  db?: Database.Database;
  outDir: string;
  rootDir?: string;
  generatedAt?: string;
}

export interface DataBundleResult {
  dataFile: string;
  symbolCount: number;
  classCount: number;
  moduleCount: number;
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

export function createSiteDataBundle(
  data: LoadedSiteData,
  generatedAt = new Date().toISOString(),
  rootDir?: string,
): SiteDataBundle {
  const complexity = buildComplexityModel(data.symbols, data.files);

  return {
    schemaVersion: SITE_DATA_BUNDLE_SCHEMA_VERSION,
    generatedAt,
    symbols: data.symbols,
    relationships: data.relationships,
    patterns: data.patterns,
    files: data.files,
    docs: data.docEntries,
    archViolations: data.archViolations,
    reaperFindings: data.reaperFindings,
    sourceFiles: buildSourceFiles(data.files, rootDir),
    search: buildSearchIndex(data.symbols),
    complexity,
    health: buildSiteHealth(data),
  };
}

export function generateDataBundle(options: DataBundleOptions): DataBundleResult {
  const ownsDb = !options.db;
  const db = options.db ?? new Database(options.dbPath!, { readonly: true });

  try {
    const data = loadSiteData(db, options.rootDir);
    const bundle = createSiteDataBundle(data, options.generatedAt, options.rootDir);
    fs.mkdirSync(options.outDir, { recursive: true });

    const dataFile = path.join(options.outDir, "site-data.json");
    fs.writeFileSync(dataFile, JSON.stringify(bundle, null, 2), "utf-8");

    return {
      dataFile,
      symbolCount: bundle.symbols.length,
      classCount: bundle.complexity.classes.length,
      moduleCount: bundle.complexity.modules.length,
    };
  } finally {
    if (ownsDb) db.close();
  }
}
