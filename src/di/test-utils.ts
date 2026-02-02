import "reflect-metadata";
import { container } from "tsyringe";
import Database from "better-sqlite3";
import { initializeSchema } from "../storage/db.js";
import { createSymbolRepository } from "../storage/db.js";
import { createRelationshipRepository } from "../storage/db.js";
import { createFileHashRepository } from "../storage/db.js";
import { createDocRegistry } from "../docs/docRegistry.js";
import { createKnowledgeGraph } from "../knowledge/graph.js";
import { createPatternAnalyzer } from "../patterns/patternAnalyzer.js";
import { createEventFlowAnalyzer } from "../events/eventFlowAnalyzer.js";
import { createArchGuard } from "../governance/archGuard.js";
import { createReaper } from "../governance/reaper.js";
import { createContextMapper } from "../business/contextMapper.js";
import { createBusinessTranslator } from "../business/businessTranslator.js";
import { createCodeExampleValidator } from "../docs/codeExampleValidator.js";
import { createRagIndex } from "../knowledge/rag.js";
import type { ResolvedConfig } from "../configLoader.js";
import type { LlmProvider } from "../llm/provider.js";

import {
  DATABASE_TOKEN,
  CONFIG_TOKEN,
  SYMBOL_REPO_TOKEN,
  RELATIONSHIP_REPO_TOKEN,
  FILE_HASH_REPO_TOKEN,
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
} from "./tokens.js";

const DEFAULT_TEST_CONFIG: ResolvedConfig = {
  projectRoot: "/tmp/test",
  include: ["**/*.ts"],
  exclude: ["node_modules/**"],
  respectGitignore: false,
  maxFileSize: 100_000,
  dbPath: ":memory:",
  promptRules: [],
  docs: [],
  defaultPrompts: {
    symbolPrompt: "test",
    docPrompt: "test",
    changePrompt: "test",
  },
  llm: {
    provider: "none",
    apiKey: undefined,
    model: "test",
    maxTokens: 100,
    temperature: 0,
  },
} as ResolvedConfig;

const NOOP_LLM: LlmProvider = {
  async chat() { return "mock response"; },
  async embed(texts: string[]) { return texts.map(() => new Array(128).fill(0)); },
};

export function setupTestContainer(configOverrides?: Partial<ResolvedConfig>): void {
  container.reset();

  const config = { ...DEFAULT_TEST_CONFIG, ...configOverrides } as ResolvedConfig;
  const db = new Database(":memory:");
  initializeSchema(db);

  container.register(CONFIG_TOKEN, { useValue: config });
  container.register(DATABASE_TOKEN, { useValue: db });
  container.register(SYMBOL_REPO_TOKEN, { useValue: createSymbolRepository(db) });
  container.register(RELATIONSHIP_REPO_TOKEN, { useValue: createRelationshipRepository(db) });
  container.register(FILE_HASH_REPO_TOKEN, { useValue: createFileHashRepository(db) });
  container.register(DOC_REGISTRY_TOKEN, { useValue: createDocRegistry(db) });
  container.register(KNOWLEDGE_GRAPH_TOKEN, { useValue: createKnowledgeGraph(db) });
  container.register(PATTERN_ANALYZER_TOKEN, { useValue: createPatternAnalyzer() });
  container.register(EVENT_FLOW_ANALYZER_TOKEN, { useValue: createEventFlowAnalyzer() });
  container.register(LLM_PROVIDER_TOKEN, { useValue: NOOP_LLM });
  container.register(RAG_INDEX_TOKEN, {
    useValue: createRagIndex({
      embeddingModel: "test",
      db,
      embedFn: (texts: string[]) => NOOP_LLM.embed(texts),
    }),
  });
  container.register(ARCH_GUARD_TOKEN, { useValue: createArchGuard() });
  container.register(REAPER_TOKEN, { useValue: createReaper() });
  container.register(CONTEXT_MAPPER_TOKEN, { useValue: createContextMapper(config) });
  container.register(BUSINESS_TRANSLATOR_TOKEN, { useValue: createBusinessTranslator(NOOP_LLM) });
  container.register(CODE_EXAMPLE_VALIDATOR_TOKEN, { useValue: createCodeExampleValidator() });
}

export function mockService<T>(token: symbol, impl: T): void {
  container.register(token, { useValue: impl });
}
