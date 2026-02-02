import fs from "node:fs";
import Database from "better-sqlite3";
import { loadConfig } from "../../configLoader.js";
import {
  createSymbolRepository,
  createRelationshipRepository,
  relationshipRowsToSymbolRelationships,
} from "../../storage/db.js";
import { createPatternAnalyzer } from "../../patterns/patternAnalyzer.js";
import { resolveConfigPath } from "../utils/index.js";

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
  const { dbPath: customDbPath } = params;

  const configDir = process.cwd();
  const config = await loadConfig(configDir);
  const dbPath = resolveConfigPath(customDbPath, configDir, config.dbPath);

  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database not found at ${dbPath}. Run docs-kit index first.`);
  }

  const db = new Database(dbPath);
  try {
    const symbolRepo = createSymbolRepository(db);
    const relRepo = createRelationshipRepository(db);
    const patternAnalyzerInst = createPatternAnalyzer();

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
