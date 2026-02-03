import "reflect-metadata";
import { container } from "tsyringe";
import Database from "better-sqlite3";
import { loadConfig } from "../configLoader.js";
import { initializeSchema } from "../storage/db.js";
import { createSymbolRepository } from "../storage/db.js";
import { createRelationshipRepository } from "../storage/db.js";
import { createFileHashRepository } from "../storage/db.js";
import { createDocRegistry } from "../docs/docRegistry.js";
import { createKnowledgeGraph } from "../knowledge/graph.js";
import { createPatternAnalyzer } from "../patterns/patternAnalyzer.js";
import { createEventFlowAnalyzer } from "../events/eventFlowAnalyzer.js";
import { createRagIndex } from "../knowledge/rag.js";
import { ArchGuard, createArchGuard } from "../governance/archGuard.js";
import { expandAllLanguageGuards } from "../governance/languageGuardManager.js";
import { createReaper } from "../governance/reaper.js";
import { createContextMapper } from "../business/contextMapper.js";
import { createBusinessTranslator } from "../business/businessTranslator.js";
import { createCodeExampleValidator } from "../docs/codeExampleValidator.js";
import { createLlmProvider } from "../llm/provider.js";

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

export interface SetupContainerOptions {
  cwd?: string;
  dbPath?: string;
}

export async function setupContainer(
  cwdOrOptions: string | SetupContainerOptions = process.cwd(),
): Promise<void> {
  const opts = typeof cwdOrOptions === "string" ? { cwd: cwdOrOptions } : cwdOrOptions;
  const cwd = opts.cwd ?? process.cwd();

  resetContainer();

  const config = await loadConfig(cwd);
  const dbPath = opts.dbPath ?? config.dbPath;
  const db = new Database(dbPath);
  initializeSchema(db);

  container.register(CONFIG_TOKEN, { useValue: config });
  container.register(DATABASE_TOKEN, { useValue: db });

  // Repositories
  container.register(SYMBOL_REPO_TOKEN, { useValue: createSymbolRepository(db) });
  container.register(RELATIONSHIP_REPO_TOKEN, { useValue: createRelationshipRepository(db) });
  container.register(FILE_HASH_REPO_TOKEN, { useValue: createFileHashRepository(db) });

  // Doc registry
  container.register(DOC_REGISTRY_TOKEN, { useValue: createDocRegistry(db) });

  // Knowledge
  container.register(KNOWLEDGE_GRAPH_TOKEN, { useValue: createKnowledgeGraph(db) });

  // Leaf services
  container.register(PATTERN_ANALYZER_TOKEN, { useValue: createPatternAnalyzer() });
  container.register(EVENT_FLOW_ANALYZER_TOKEN, { useValue: createEventFlowAnalyzer() });

  // LLM
  const llm = createLlmProvider(config);
  container.register(LLM_PROVIDER_TOKEN, { useValue: llm });

  // RAG
  container.register(RAG_INDEX_TOKEN, {
    useValue: createRagIndex({
      embeddingModel: config.llm.embeddingModel ?? "text-embedding-ada-002",
      db,
      embedFn: (texts: string[]) => llm.embed(texts),
    }),
  });

  // Governance
  const archGuard = createArchGuard();

  const rules = config.archGuard?.languages
    ? expandAllLanguageGuards(config.archGuard)
    : ((config.archGuard as ArchGuard & { rules?: typeof DEFAULT_ARCH_RULES })?.rules ??
      DEFAULT_ARCH_RULES);

  archGuard.setRules(rules);
  container.register(ARCH_GUARD_TOKEN, { useValue: archGuard });
  container.register(REAPER_TOKEN, { useValue: createReaper() });

  // Business
  container.register(CONTEXT_MAPPER_TOKEN, { useValue: createContextMapper(config) });
  container.register(BUSINESS_TRANSLATOR_TOKEN, { useValue: createBusinessTranslator(llm) });
  container.register(CODE_EXAMPLE_VALIDATOR_TOKEN, { useValue: createCodeExampleValidator() });
}

export function resetContainer(): void {
  container.reset();
}

export function resolve<T>(token: symbol): T {
  return container.resolve<T>(token);
}

export { container };
