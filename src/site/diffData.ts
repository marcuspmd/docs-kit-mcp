import type { GitDiffRange } from "../analyzer/gitDiff.js";
import type { UpdateResult } from "../docs/docUpdater.js";
import type { DocGuardResult } from "../governance/docGuardCli.js";
import type { ChangeImpact, CodeSymbol } from "../indexer/symbol.types.js";
import type { LoadedSiteData } from "./dataLoader.js";

export interface DiffImpactSummary {
  symbolId: string;
  symbolName: string;
  qualifiedName?: string;
  kind: string;
  file: string;
  startLine: number;
  endLine: number;
  changeType: ChangeImpact["changeType"];
  docUpdateRequired: boolean;
  diff: string;
}

export interface DiffDocUpdateSummary {
  docPath: string;
  symbolName: string;
  action: UpdateResult["action"];
  sectionHeading?: string;
  diff?: string;
}

export interface DiffSiteMetadata {
  base: string;
  head: string;
  range: GitDiffRange;
  changedFiles: string[];
  impacts: DiffImpactSummary[];
  docUpdates: DiffDocUpdateSummary[];
  docGuard: DocGuardResult;
}

export interface BuildDiffSiteMetadataOptions {
  base: string;
  head?: string;
  range: GitDiffRange;
  changedFiles: string[];
  impacts: ChangeImpact[];
  docUpdates: UpdateResult[];
  docGuard: DocGuardResult;
}

export interface FilterSiteDataForDiffOptions {
  impacts: ChangeImpact[];
  changedFiles: string[];
  docUpdates?: UpdateResult[];
}

function uniqueSorted(values: Iterable<string>): string[] {
  return Array.from(new Set(values)).filter(Boolean).sort();
}

function summarizeImpact(impact: ChangeImpact): DiffImpactSummary {
  return {
    symbolId: impact.symbol.id,
    symbolName: impact.symbol.name,
    qualifiedName: impact.symbol.qualifiedName,
    kind: impact.symbol.kind,
    file: impact.symbol.file,
    startLine: impact.symbol.startLine,
    endLine: impact.symbol.endLine,
    changeType: impact.changeType,
    docUpdateRequired: impact.docUpdateRequired,
    diff: impact.diff,
  };
}

function summarizeDocUpdate(update: UpdateResult): DiffDocUpdateSummary {
  return {
    docPath: update.docPath,
    symbolName: update.symbolName,
    action: update.action,
    sectionHeading: update.sectionHeading,
    diff: update.diff,
  };
}

export function buildDiffSiteMetadata(options: BuildDiffSiteMetadataOptions): DiffSiteMetadata {
  return {
    base: options.base,
    head: options.head ?? "HEAD",
    range: options.range,
    changedFiles: uniqueSorted(options.changedFiles),
    impacts: options.impacts.map(summarizeImpact),
    docUpdates: options.docUpdates.map(summarizeDocUpdate),
    docGuard: options.docGuard,
  };
}

function isMarkdownPath(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(".md");
}

function addParentChain(
  symbol: CodeSymbol,
  symbolsById: Map<string, CodeSymbol>,
  ids: Set<string>,
) {
  let parentId = symbol.parent;
  while (parentId) {
    const parent = symbolsById.get(parentId);
    if (!parent || ids.has(parent.id)) break;
    ids.add(parent.id);
    parentId = parent.parent;
  }
}

function buildSymbolMap(data: LoadedSiteData, impacts: ChangeImpact[]): Map<string, CodeSymbol> {
  const symbolsById = new Map<string, CodeSymbol>();
  for (const symbol of data.symbols) {
    symbolsById.set(symbol.id, symbol);
  }
  for (const impact of impacts) {
    if (!symbolsById.has(impact.symbol.id)) {
      symbolsById.set(impact.symbol.id, impact.symbol);
    }
  }
  return symbolsById;
}

export function filterSiteDataForDiff(
  data: LoadedSiteData,
  options: FilterSiteDataForDiffOptions,
): LoadedSiteData {
  const changedCodeFiles = new Set(options.changedFiles.filter((file) => !isMarkdownPath(file)));
  const changedDocs = new Set(options.changedFiles.filter(isMarkdownPath));
  const impactedIds = new Set(options.impacts.map((impact) => impact.symbol.id));
  const impactedSymbolKeys = new Set(
    options.impacts.map((impact) => `${impact.symbol.file}:${impact.symbol.name}`),
  );
  const symbolsById = buildSymbolMap(data, options.impacts);
  const includedIds = new Set<string>();

  for (const symbol of symbolsById.values()) {
    if (
      impactedIds.has(symbol.id) ||
      changedCodeFiles.has(symbol.file) ||
      impactedSymbolKeys.has(`${symbol.file}:${symbol.name}`)
    ) {
      includedIds.add(symbol.id);
      addParentChain(symbol, symbolsById, includedIds);
    }
  }

  const symbols = Array.from(symbolsById.values())
    .filter((symbol) => includedIds.has(symbol.id))
    .sort((left, right) => {
      if (left.file !== right.file) return left.file.localeCompare(right.file);
      if (left.startLine !== right.startLine) return left.startLine - right.startLine;
      return left.name.localeCompare(right.name);
    });

  const files = uniqueSorted([...changedCodeFiles, ...symbols.map((symbol) => symbol.file)]);

  const docPaths = new Set([
    ...changedDocs,
    ...(options.docUpdates ?? []).map((update) => update.docPath).filter(Boolean),
    ...symbols.map((symbol) => symbol.docRef).filter((docRef): docRef is string => Boolean(docRef)),
  ]);

  return {
    symbols,
    relationships: data.relationships.filter(
      (relationship) =>
        includedIds.has(relationship.source_id) && includedIds.has(relationship.target_id),
    ),
    patterns: data.patterns
      .filter((pattern) => pattern.symbols.some((symbolId) => includedIds.has(symbolId)))
      .map((pattern) => ({
        ...pattern,
        symbols: pattern.symbols.filter((symbolId) => includedIds.has(symbolId)),
      })),
    files,
    archViolations: [],
    reaperFindings: [],
    docEntries: data.docEntries.filter((entry) => docPaths.has(entry.path)),
    docsConfigDir: data.docsConfigDir,
  };
}
