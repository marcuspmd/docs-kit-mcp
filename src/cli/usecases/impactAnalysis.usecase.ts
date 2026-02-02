import "reflect-metadata";
import { setupContainer, resolve } from "../../di/container.js";
import {
  SYMBOL_REPO_TOKEN,
  KNOWLEDGE_GRAPH_TOKEN,
  DATABASE_TOKEN,
} from "../../di/tokens.js";
import type { SymbolRepository } from "../../storage/db.js";
import type { KnowledgeGraph } from "../../knowledge/graph.js";
import type Database from "better-sqlite3";
import { buildImpactAnalysisPrompt } from "../../prompts/impactAnalysis.prompt.js";
import { resolveConfigPath } from "../utils/index.js";
import { loadConfig } from "../../configLoader.js";

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
  const { symbolName, maxDepth = 3 } = params;

  if (!symbolName) {
    throw new Error("Symbol name is required");
  }

  const configDir = process.cwd();
  const config = await loadConfig(configDir);
  const dbPath = resolveConfigPath(params.dbPath, configDir, config.dbPath);

  await setupContainer({ cwd: configDir, dbPath });

  const db = resolve<Database.Database>(DATABASE_TOKEN);
  try {
    const symbolRepo = resolve<SymbolRepository>(SYMBOL_REPO_TOKEN);
    const graph = resolve<KnowledgeGraph>(KNOWLEDGE_GRAPH_TOKEN);

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
