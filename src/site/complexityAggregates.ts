import type { CodeSymbol } from "../indexer/symbol.types.js";

export interface ComplexityThresholds {
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  maxNestingDepth: number;
}

export interface ComplexityStats {
  symbolCount: number;
  totalLinesOfCode: number;
  avgCyclomaticComplexity: number;
  maxCyclomaticComplexity: number;
  avgCognitiveComplexity: number;
  maxCognitiveComplexity: number;
  avgNestingDepth: number;
  maxNestingDepth: number;
}

export interface SymbolComplexityEntry {
  id: string;
  name: string;
  qualifiedName?: string;
  kind: CodeSymbol["kind"];
  file: string;
  startLine: number;
  endLine: number;
  parent?: string;
  linesOfCode: number;
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  maxNestingDepth: number;
  coveragePercent: number | null;
  riskScore: number;
  aboveThresholds: string[];
}

export interface ClassComplexityAggregate extends ComplexityStats {
  id: string;
  name: string;
  qualifiedName?: string;
  file: string;
  startLine: number;
  endLine: number;
  memberCount: number;
  symbolIds: string[];
  hotspotSymbolIds: string[];
  riskScore: number;
}

export interface ModuleComplexityAggregate extends ComplexityStats {
  path: string;
  parentPath?: string;
  depth: number;
  fileCount: number;
  classCount: number;
  functionCount: number;
  symbolIds: string[];
  hotspotSymbolIds: string[];
  riskScore: number;
}

export interface ProjectComplexityAggregate extends ComplexityStats {
  fileCount: number;
  classCount: number;
  functionCount: number;
  highComplexitySymbolCount: number;
}

export interface ComplexityModel {
  thresholds: ComplexityThresholds;
  project: ProjectComplexityAggregate;
  symbols: SymbolComplexityEntry[];
  classes: ClassComplexityAggregate[];
  modules: ModuleComplexityAggregate[];
  topSymbols: SymbolComplexityEntry[];
  topClasses: ClassComplexityAggregate[];
  topModules: ModuleComplexityAggregate[];
}

export const DEFAULT_COMPLEXITY_THRESHOLDS: ComplexityThresholds = {
  cyclomaticComplexity: 10,
  cognitiveComplexity: 15,
  maxNestingDepth: 4,
};

const CLASS_KINDS = new Set<CodeSymbol["kind"]>(["class", "abstract_class"]);
const FUNCTION_KINDS = new Set<CodeSymbol["kind"]>(["function", "method", "constructor", "lambda"]);

function round(value: number): number {
  return Number(value.toFixed(2));
}

function getLinesOfCode(symbol: CodeSymbol): number {
  return symbol.metrics?.linesOfCode ?? symbol.endLine - symbol.startLine + 1;
}

function getCyclomaticComplexity(symbol: CodeSymbol): number {
  return symbol.metrics?.cyclomaticComplexity ?? 0;
}

function getCognitiveComplexity(symbol: CodeSymbol): number {
  return symbol.metrics?.cognitiveComplexity ?? 0;
}

function getMaxNestingDepth(symbol: CodeSymbol): number {
  return symbol.metrics?.maxNestingDepth ?? 0;
}

function riskScoreForValues(values: {
  linesOfCode: number;
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  maxNestingDepth: number;
  coveragePercent?: number | null;
}): number {
  const base =
    values.cognitiveComplexity * 2 +
    values.cyclomaticComplexity * 1.5 +
    values.maxNestingDepth * 3 +
    values.linesOfCode / 25;
  // High coverage reduces risk: 100% coverage → 40% discount, 0% → no discount
  const coverageFactor =
    values.coveragePercent != null ? 1 - (values.coveragePercent / 100) * 0.4 : 1;
  return round(base * coverageFactor);
}

function sortByRisk<T extends { riskScore: number }>(left: T, right: T): number {
  return right.riskScore - left.riskScore;
}

function summarizeSymbols(symbols: CodeSymbol[]): ComplexityStats {
  if (symbols.length === 0) {
    return {
      symbolCount: 0,
      totalLinesOfCode: 0,
      avgCyclomaticComplexity: 0,
      maxCyclomaticComplexity: 0,
      avgCognitiveComplexity: 0,
      maxCognitiveComplexity: 0,
      avgNestingDepth: 0,
      maxNestingDepth: 0,
    };
  }

  const totals = symbols.reduce(
    (acc, symbol) => {
      const linesOfCode = getLinesOfCode(symbol);
      const cyclomaticComplexity = getCyclomaticComplexity(symbol);
      const cognitiveComplexity = getCognitiveComplexity(symbol);
      const maxNestingDepth = getMaxNestingDepth(symbol);

      acc.totalLinesOfCode += linesOfCode;
      acc.totalCyclomaticComplexity += cyclomaticComplexity;
      acc.totalCognitiveComplexity += cognitiveComplexity;
      acc.totalNestingDepth += maxNestingDepth;
      acc.maxCyclomaticComplexity = Math.max(acc.maxCyclomaticComplexity, cyclomaticComplexity);
      acc.maxCognitiveComplexity = Math.max(acc.maxCognitiveComplexity, cognitiveComplexity);
      acc.maxNestingDepth = Math.max(acc.maxNestingDepth, maxNestingDepth);
      return acc;
    },
    {
      totalLinesOfCode: 0,
      totalCyclomaticComplexity: 0,
      totalCognitiveComplexity: 0,
      totalNestingDepth: 0,
      maxCyclomaticComplexity: 0,
      maxCognitiveComplexity: 0,
      maxNestingDepth: 0,
    },
  );

  return {
    symbolCount: symbols.length,
    totalLinesOfCode: totals.totalLinesOfCode,
    avgCyclomaticComplexity: round(totals.totalCyclomaticComplexity / symbols.length),
    maxCyclomaticComplexity: totals.maxCyclomaticComplexity,
    avgCognitiveComplexity: round(totals.totalCognitiveComplexity / symbols.length),
    maxCognitiveComplexity: totals.maxCognitiveComplexity,
    avgNestingDepth: round(totals.totalNestingDepth / symbols.length),
    maxNestingDepth: totals.maxNestingDepth,
  };
}

function toSymbolComplexityEntry(
  symbol: CodeSymbol,
  thresholds: ComplexityThresholds,
): SymbolComplexityEntry {
  const linesOfCode = getLinesOfCode(symbol);
  const cyclomaticComplexity = getCyclomaticComplexity(symbol);
  const cognitiveComplexity = getCognitiveComplexity(symbol);
  const maxNestingDepth = getMaxNestingDepth(symbol);
  const aboveThresholds: string[] = [];

  if (cyclomaticComplexity > thresholds.cyclomaticComplexity) {
    aboveThresholds.push("cyclomaticComplexity");
  }
  if (cognitiveComplexity > thresholds.cognitiveComplexity) {
    aboveThresholds.push("cognitiveComplexity");
  }
  if (maxNestingDepth > thresholds.maxNestingDepth) {
    aboveThresholds.push("maxNestingDepth");
  }

  const coveragePercent = symbol.metrics?.testCoverage?.coveragePercent ?? null;

  return {
    id: symbol.id,
    name: symbol.name,
    qualifiedName: symbol.qualifiedName,
    kind: symbol.kind,
    file: symbol.file,
    startLine: symbol.startLine,
    endLine: symbol.endLine,
    parent: symbol.parent,
    linesOfCode,
    cyclomaticComplexity,
    cognitiveComplexity,
    maxNestingDepth,
    coveragePercent,
    riskScore: riskScoreForValues({
      linesOfCode,
      cyclomaticComplexity,
      cognitiveComplexity,
      maxNestingDepth,
      coveragePercent,
    }),
    aboveThresholds,
  };
}

function modulePrefixes(filePath: string): string[] {
  const segments = filePath.split("/").filter(Boolean);
  if (segments.length <= 1) return ["root"];

  const prefixes: string[] = [];
  for (let index = 1; index < segments.length; index++) {
    prefixes.push(segments.slice(0, index).join("/"));
  }
  return prefixes.length > 0 ? prefixes : ["root"];
}

function parentModulePath(modulePath: string): string | undefined {
  if (modulePath === "root") return undefined;
  const index = modulePath.lastIndexOf("/");
  return index === -1 ? undefined : modulePath.slice(0, index);
}

export function buildComplexityModel(
  symbols: CodeSymbol[],
  files: string[],
  thresholds: ComplexityThresholds = DEFAULT_COMPLEXITY_THRESHOLDS,
): ComplexityModel {
  const symbolEntries = symbols.map((symbol) => toSymbolComplexityEntry(symbol, thresholds));

  const classes = symbols
    .filter((symbol) => CLASS_KINDS.has(symbol.kind))
    .map((classSymbol) => {
      const members = symbols.filter((symbol) => symbol.parent === classSymbol.id);
      const aggregatedSymbols = [classSymbol, ...members];
      const stats = summarizeSymbols(aggregatedSymbols);
      const hotspotSymbolIds = aggregatedSymbols
        .map((symbol) => toSymbolComplexityEntry(symbol, thresholds))
        .sort(sortByRisk)
        .slice(0, 5)
        .map((entry) => entry.id);

      return {
        ...stats,
        id: classSymbol.id,
        name: classSymbol.name,
        qualifiedName: classSymbol.qualifiedName,
        file: classSymbol.file,
        startLine: classSymbol.startLine,
        endLine: classSymbol.endLine,
        memberCount: members.length,
        symbolIds: aggregatedSymbols.map((symbol) => symbol.id),
        hotspotSymbolIds,
        riskScore: riskScoreForValues({
          linesOfCode: stats.totalLinesOfCode,
          cyclomaticComplexity: stats.maxCyclomaticComplexity,
          cognitiveComplexity: stats.maxCognitiveComplexity,
          maxNestingDepth: stats.maxNestingDepth,
        }),
      } satisfies ClassComplexityAggregate;
    })
    .sort(sortByRisk);

  const moduleFileMap = new Map<string, Set<string>>();
  for (const file of files) {
    for (const prefix of modulePrefixes(file)) {
      const currentFiles = moduleFileMap.get(prefix) ?? new Set<string>();
      currentFiles.add(file);
      moduleFileMap.set(prefix, currentFiles);
    }
  }

  const moduleSymbolMap = new Map<string, CodeSymbol[]>();
  for (const symbol of symbols) {
    for (const prefix of modulePrefixes(symbol.file)) {
      const currentSymbols = moduleSymbolMap.get(prefix) ?? [];
      currentSymbols.push(symbol);
      moduleSymbolMap.set(prefix, currentSymbols);
    }
  }

  const modules = [...moduleSymbolMap.entries()]
    .map(([modulePath, moduleSymbols]) => {
      const stats = summarizeSymbols(moduleSymbols);
      const hotspotSymbolIds = moduleSymbols
        .map((symbol) => toSymbolComplexityEntry(symbol, thresholds))
        .sort(sortByRisk)
        .slice(0, 10)
        .map((entry) => entry.id);

      return {
        ...stats,
        path: modulePath,
        parentPath: parentModulePath(modulePath),
        depth: modulePath === "root" ? 0 : modulePath.split("/").length,
        fileCount: moduleFileMap.get(modulePath)?.size ?? 0,
        classCount: moduleSymbols.filter((symbol) => CLASS_KINDS.has(symbol.kind)).length,
        functionCount: moduleSymbols.filter((symbol) => FUNCTION_KINDS.has(symbol.kind)).length,
        symbolIds: moduleSymbols.map((symbol) => symbol.id),
        hotspotSymbolIds,
        riskScore: riskScoreForValues({
          linesOfCode: stats.totalLinesOfCode,
          cyclomaticComplexity: stats.maxCyclomaticComplexity,
          cognitiveComplexity: stats.maxCognitiveComplexity,
          maxNestingDepth: stats.maxNestingDepth,
        }),
      } satisfies ModuleComplexityAggregate;
    })
    .sort(sortByRisk);

  const projectStats = summarizeSymbols(symbols);
  const project: ProjectComplexityAggregate = {
    ...projectStats,
    fileCount: files.length,
    classCount: symbols.filter((symbol) => CLASS_KINDS.has(symbol.kind)).length,
    functionCount: symbols.filter((symbol) => FUNCTION_KINDS.has(symbol.kind)).length,
    highComplexitySymbolCount: symbolEntries.filter((entry) => entry.aboveThresholds.length > 0)
      .length,
  };

  return {
    thresholds,
    project,
    symbols: symbolEntries.sort(sortByRisk),
    classes,
    modules,
    topSymbols: [...symbolEntries].sort(sortByRisk).slice(0, 20),
    topClasses: classes.slice(0, 20),
    topModules: modules.slice(0, 20),
  };
}
