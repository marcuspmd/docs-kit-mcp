import Database from "better-sqlite3";
import { loadConfig } from "../configLoader.js";
import { createDocRegistry } from "../docs/docRegistry.js";
import { createKnowledgeGraph } from "../knowledge/graph.js";
import {
  createSymbolRepository,
  createRelationshipRepository,
} from "../storage/db.js";
import { createPatternAnalyzer } from "../patterns/patternAnalyzer.js";
import { createEventFlowAnalyzer } from "../events/eventFlowAnalyzer.js";
import { createRagIndex } from "../knowledge/rag.js";
import { createArchGuard } from "../governance/archGuard.js";
import { createReaper } from "../governance/reaper.js";
import { createContextMapper } from "../business/contextMapper.js";
import { createBusinessTranslator } from "../business/businessTranslator.js";
import { createCodeExampleValidator } from "../docs/codeExampleValidator.js";
import { createLlmProvider } from "../llm/provider.js";
import type { ServerDependencies } from "./types.js";

/**
 * Default arch-guard rules
 */
const DEFAULT_ARCH_RULES = [
  {
    name: "ClassNaming",
    description: "Classes should be PascalCase",
    type: "naming_convention" as const,
    severity: "warning" as const,
    config: { pattern: "^[A-Z][a-zA-Z0-9]*$", kind: "class" },
  },
  {
    name: "MethodNaming",
    description: "Methods should be camelCase",
    type: "naming_convention" as const,
    severity: "warning" as const,
    config: { pattern: "^[a-z][a-zA-Z0-9]*$", kind: "method" },
  },
  {
    name: "FunctionNaming",
    description: "Functions should be camelCase",
    type: "naming_convention" as const,
    severity: "warning" as const,
    config: { pattern: "^[a-z][a-zA-Z0-9]*$", kind: "function" },
  },
];

/**
 * Initialize all server dependencies
 */
export async function createServerDependencies(
  cwd: string = process.cwd(),
): Promise<ServerDependencies> {
  const config = await loadConfig(cwd);

  const db = new Database(config.dbPath);
  const registry = createDocRegistry(db);
  const symbolRepo = createSymbolRepository(db);
  const relRepo = createRelationshipRepository(db);
  const graph = createKnowledgeGraph(db);
  const patternAnalyzer = createPatternAnalyzer();
  const eventFlowAnalyzer = createEventFlowAnalyzer();
  const llm = createLlmProvider(config);
  const ragIndex = createRagIndex({
    embeddingModel: config.llm.embeddingModel ?? "text-embedding-ada-002",
    db,
    embedFn: (texts: string[]) => llm.embed(texts),
  });
  const archGuard = createArchGuard();
  archGuard.setRules(DEFAULT_ARCH_RULES);
  const reaper = createReaper();
  const contextMapper = createContextMapper();
  const businessTranslator = createBusinessTranslator(llm);
  const codeExampleValidator = createCodeExampleValidator();

  return {
    config,
    db,
    registry,
    symbolRepo,
    relRepo,
    graph,
    patternAnalyzer,
    eventFlowAnalyzer,
    llm,
    ragIndex,
    archGuard,
    reaper,
    contextMapper,
    businessTranslator,
    codeExampleValidator,
  };
}
