import fs from "node:fs";
import Database from "better-sqlite3";
import { loadConfig } from "../../configLoader.js";
import { createSymbolRepository } from "../../storage/db.js";
import { createKnowledgeGraph } from "../../knowledge/graph.js";
import { buildImpactAnalysisPrompt } from "../../prompts/impactAnalysis.prompt.js";
import { resolveConfigPath } from "../utils/index.js";

/**
 * Impact analysis command - Analyze what breaks if a symbol changes
 */
export interface ImpactAnalysisUseCaseParams {
  symbolName: string;
  maxDepth?: number;
  dbPath?: string;
  docsDir?: string;
}

export async function impactAnalysisUseCase(params: ImpactAnalysisUseCaseParams): Promise<string> {
  const { symbolName, maxDepth = 3, dbPath: customDbPath } = params;

  if (!symbolName) {
    throw new Error("Symbol name is required");
  }

  const configDir = process.cwd();
  const config = await loadConfig(configDir);
  const dbPath = resolveConfigPath(customDbPath, configDir, config.dbPath);

  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database not found at ${dbPath}. Run docs-kit index first.`);
  }

  const db = new Database(dbPath);
  try {
    const symbolRepo = createSymbolRepository(db);
    const graph = createKnowledgeGraph(db);
    
    const symbols = symbolRepo.findByName(symbolName);
    if (symbols.length === 0) {
      return `No symbol found with name: ${symbolName}`;
    }

    const targetSymbol = symbols[0];
    const impactedIds = graph.getImpactRadius(targetSymbol.id, maxDepth);
    const impactedSymbols = symbolRepo.findByIds(impactedIds);
    
    const prompt = buildImpactAnalysisPrompt({ targetSymbol, impactedSymbols, maxDepth });
    return prompt;
  } finally {
    db.close();
  }
}
