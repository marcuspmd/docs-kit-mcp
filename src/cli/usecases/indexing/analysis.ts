import fs from "node:fs";
import path from "node:path";
import type Parser from "tree-sitter";
import type { ResolvedConfig } from "../../../configLoader.js";
import { parseLcov, type LcovFileData } from "../../../indexer/lcovCollector.js";
import { collectMetrics } from "../../../indexer/metricsCollector.js";
import { extractRelationships } from "../../../indexer/relationshipExtractor.js";
import type { CodeSymbol, SymbolRelationship } from "../../../indexer/symbol.types.js";
import type { PatternAnalyzer } from "../../../patterns/patternAnalyzer.js";
import type { PatternRowForInsert } from "../../../storage/db.js";
import { resolve } from "../../../di/container.js";
import { PATTERN_ANALYZER_TOKEN } from "../../../di/tokens.js";
import { done, step } from "../../utils/index.js";

export async function extractRelationshipsPhase(
  allSymbols: CodeSymbol[],
  trees: Map<string, Parser.Tree>,
  sources: Map<string, string>,
) {
  step("Extracting relationships");
  const relationships = extractRelationships({
    symbols: allSymbols,
    trees,
    sources,
  });
  done(`${relationships.length} relationships`);
  return relationships;
}

export function populateReferences(allSymbols: CodeSymbol[], relationships: SymbolRelationship[]) {
  const symbolById = new Map(allSymbols.map((symbol) => [symbol.id, symbol]));
  for (const relationship of relationships) {
    const source = symbolById.get(relationship.sourceId);
    const target = symbolById.get(relationship.targetId);
    if (source) {
      if (!source.references) source.references = [];
      if (!source.references.includes(relationship.targetId)) {
        source.references.push(relationship.targetId);
      }
    }
    if (target) {
      if (!target.referencedBy) target.referencedBy = [];
      if (!target.referencedBy.includes(relationship.sourceId)) {
        target.referencedBy.push(relationship.sourceId);
      }
    }
  }
}

export async function loadCoverageData(
  config: ResolvedConfig,
  configDir: string,
): Promise<LcovFileData[] | undefined> {
  let coverageData: LcovFileData[] | undefined;
  if (config.coverage?.enabled) {
    const lcovPath = path.resolve(configDir, config.coverage.lcovPath);
    if (fs.existsSync(lcovPath)) {
      step("Loading test coverage data");
      try {
        coverageData = await parseLcov(lcovPath);
        done(`loaded from ${config.coverage.lcovPath}`);
      } catch (err) {
        console.warn(
          `  ⚠ Failed to parse lcov file: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } else {
      console.warn(`  ⚠ Coverage enabled but lcov file not found: ${config.coverage.lcovPath}`);
    }
  }
  return coverageData;
}

export async function collectMetricsPhase(
  allSymbols: CodeSymbol[],
  trees: Map<string, Parser.Tree>,
  coverageData: LcovFileData[] | undefined,
  projectRoot: string,
) {
  step("Computing metrics");
  const updatedSymbols = collectMetrics({
    symbols: allSymbols,
    trees,
    coverage: coverageData,
    projectRoot,
  });
  allSymbols.splice(0, allSymbols.length, ...updatedSymbols);
  done();
}

export async function detectPatterns(
  allSymbols: CodeSymbol[],
  relationships: SymbolRelationship[],
): Promise<PatternRowForInsert[]> {
  step("Detecting patterns");
  const patternAnalyzer = resolve<PatternAnalyzer>(PATTERN_ANALYZER_TOKEN);
  const symRelationships: SymbolRelationship[] = relationships.map((relationship) => ({
    sourceId: relationship.sourceId,
    targetId: relationship.targetId,
    type: relationship.type,
    location: relationship.location,
  }));
  const patterns = patternAnalyzer.analyze(allSymbols, symRelationships);

  for (const pattern of patterns) {
    for (const symbolId of pattern.symbols) {
      const symbol = allSymbols.find((candidate) => candidate.id === symbolId);
      if (symbol) {
        symbol.pattern = pattern.kind;
      }
    }
  }
  done(`${patterns.length} patterns`);
  return patterns;
}
