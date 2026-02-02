import "reflect-metadata";
import { container } from "tsyringe";
import { setupContainer } from "../di/container.js";
import type { ServerDependencies } from "./types.js";
import type { ResolvedConfig } from "../configLoader.js";
import type Database from "better-sqlite3";
import type { DocRegistry } from "../docs/docRegistry.js";
import type { SymbolRepository, RelationshipRepository } from "../storage/db.js";
import type { KnowledgeGraph } from "../knowledge/graph.js";
import type { PatternAnalyzer } from "../patterns/patternAnalyzer.js";
import type { EventFlowAnalyzer } from "../events/eventFlowAnalyzer.js";
import type { LlmProvider } from "../llm/provider.js";
import type { RagIndex } from "../knowledge/rag.js";
import type { ArchGuard } from "../governance/archGuard.js";
import type { Reaper } from "../governance/reaper.js";
import type { ContextMapper } from "../business/contextMapper.js";
import type { BusinessTranslator } from "../business/businessTranslator.js";
import type { CodeExampleValidator } from "../docs/codeExampleValidator.js";

import {
  DATABASE_TOKEN,
  CONFIG_TOKEN,
  SYMBOL_REPO_TOKEN,
  RELATIONSHIP_REPO_TOKEN,
  DOC_REGISTRY_TOKEN,
  KNOWLEDGE_GRAPH_TOKEN,
  PATTERN_ANALYZER_TOKEN,
  EVENT_FLOW_ANALYZER_TOKEN,
  LLM_PROVIDER_TOKEN,
  RAG_INDEX_TOKEN,
  ARCH_GUARD_TOKEN,
  REAPER_TOKEN,
  CONTEXT_MAPPER_TOKEN,
  BUSINESS_TRANSLATOR_TOKEN,
  CODE_EXAMPLE_VALIDATOR_TOKEN,
} from "../di/tokens.js";

/**
 * Initialize all server dependencies via DI container
 */
export async function createServerDependencies(
  cwd: string = process.cwd(),
): Promise<ServerDependencies> {
  await setupContainer(cwd);

  return {
    config: container.resolve<ResolvedConfig>(CONFIG_TOKEN),
    db: container.resolve<Database.Database>(DATABASE_TOKEN),
    registry: container.resolve<DocRegistry>(DOC_REGISTRY_TOKEN),
    symbolRepo: container.resolve<SymbolRepository>(SYMBOL_REPO_TOKEN),
    relRepo: container.resolve<RelationshipRepository>(RELATIONSHIP_REPO_TOKEN),
    graph: container.resolve<KnowledgeGraph>(KNOWLEDGE_GRAPH_TOKEN),
    patternAnalyzer: container.resolve<PatternAnalyzer>(PATTERN_ANALYZER_TOKEN),
    eventFlowAnalyzer: container.resolve<EventFlowAnalyzer>(EVENT_FLOW_ANALYZER_TOKEN),
    llm: container.resolve<LlmProvider>(LLM_PROVIDER_TOKEN),
    ragIndex: container.resolve<RagIndex>(RAG_INDEX_TOKEN),
    archGuard: container.resolve<ArchGuard>(ARCH_GUARD_TOKEN),
    reaper: container.resolve<Reaper>(REAPER_TOKEN),
    contextMapper: container.resolve<ContextMapper>(CONTEXT_MAPPER_TOKEN),
    businessTranslator: container.resolve<BusinessTranslator>(BUSINESS_TRANSLATOR_TOKEN),
    codeExampleValidator: container.resolve<CodeExampleValidator>(CODE_EXAMPLE_VALIDATOR_TOKEN),
  };
}
