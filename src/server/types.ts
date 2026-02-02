import type Database from "better-sqlite3";
import type { DocRegistry } from "../docs/docRegistry.js";
import type { SymbolRepository, RelationshipRepository } from "../storage/db.js";
import type { KnowledgeGraph } from "../knowledge/graph.js";
import type { PatternAnalyzer } from "../patterns/patternAnalyzer.js";
import type { EventFlowAnalyzer } from "../events/eventFlowAnalyzer.js";
import type { RagIndex } from "../knowledge/rag.js";
import type { ArchGuard } from "../governance/archGuard.js";
import type { Reaper } from "../governance/reaper.js";
import type { ContextMapper } from "../business/contextMapper.js";
import type { BusinessTranslator } from "../business/businessTranslator.js";
import type { CodeExampleValidator } from "../docs/codeExampleValidator.js";
import type { LlmProvider } from "../llm/provider.js";
import type { ResolvedConfig } from "../configLoader.js";

/**
 * Core dependencies shared across all MCP tools
 */
export interface ServerDependencies {
  config: ResolvedConfig;
  db: Database.Database;
  registry: DocRegistry;
  symbolRepo: SymbolRepository;
  relRepo: RelationshipRepository;
  graph: KnowledgeGraph;
  patternAnalyzer: PatternAnalyzer;
  eventFlowAnalyzer: EventFlowAnalyzer;
  llm: LlmProvider;
  ragIndex: RagIndex;
  archGuard: ArchGuard;
  reaper: Reaper;
  contextMapper: ContextMapper;
  businessTranslator: BusinessTranslator;
  codeExampleValidator: CodeExampleValidator;
}

/**
 * Helper to create a success response for MCP tools
 */
export function mcpSuccess(text: string) {
  return {
    content: [{ type: "text" as const, text }],
  };
}

/**
 * Helper to create an error response for MCP tools
 */
export function mcpError(message: string) {
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}
