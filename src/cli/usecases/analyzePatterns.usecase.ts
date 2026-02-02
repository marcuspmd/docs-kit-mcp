import "reflect-metadata";
import { setupContainer, resolve } from "../../di/container.js";
import {
  SYMBOL_REPO_TOKEN,
  RELATIONSHIP_REPO_TOKEN,
  PATTERN_ANALYZER_TOKEN,
  DATABASE_TOKEN,
} from "../../di/tokens.js";
import { relationshipRowsToSymbolRelationships } from "../../storage/db.js";
import type { SymbolRepository, RelationshipRepository } from "../../storage/db.js";
import type { PatternAnalyzer } from "../../patterns/patternAnalyzer.js";
import type Database from "better-sqlite3";
import { resolveConfigPath } from "../utils/index.js";
import { loadConfig } from "../../configLoader.js";

/**
 * Analyze patterns command - Detect design patterns and violations
 */
export interface AnalyzePatternsUseCaseParams {
  dbPath?: string;
}

export interface AnalyzePatternsResult {
  patterns: Array<{
    kind: string;
    symbols: string[];
    confidence: number;
    violations: string[];
  }>;
  totalSymbols: number;
}

export async function analyzePatternsUseCase(
  params: AnalyzePatternsUseCaseParams = {},
): Promise<AnalyzePatternsResult> {
  const configDir = process.cwd();
  const config = await loadConfig(configDir);
  const dbPath = resolveConfigPath(params.dbPath, configDir, config.dbPath);

  await setupContainer({ cwd: configDir, dbPath });

  const db = resolve<Database.Database>(DATABASE_TOKEN);
  try {
    const symbolRepo = resolve<SymbolRepository>(SYMBOL_REPO_TOKEN);
    const relRepo = resolve<RelationshipRepository>(RELATIONSHIP_REPO_TOKEN);
    const patternAnalyzerInst = resolve<PatternAnalyzer>(PATTERN_ANALYZER_TOKEN);

    const allSymbols = symbolRepo.findAll();
    const allRels = relationshipRowsToSymbolRelationships(relRepo.findAll());

    const patterns = patternAnalyzerInst.analyze(allSymbols, allRels);

    return {
      patterns,
      totalSymbols: allSymbols.length,
    };
  } finally {
    db.close();
  }
}
