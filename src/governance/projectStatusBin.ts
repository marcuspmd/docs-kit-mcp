#!/usr/bin/env node

import "reflect-metadata";
import { parseArgs } from "node:util";
import { setupContainer, resolve } from "../di/container.js";
import {
  DATABASE_TOKEN,
  DOC_REGISTRY_TOKEN,
  SYMBOL_REPO_TOKEN,
  RELATIONSHIP_REPO_TOKEN,
  KNOWLEDGE_GRAPH_TOKEN,
  PATTERN_ANALYZER_TOKEN,
  ARCH_GUARD_TOKEN,
  REAPER_TOKEN,
} from "../di/tokens.js";
import type Database from "better-sqlite3";
import type { DocRegistry } from "../docs/docRegistry.js";
import type { SymbolRepository, RelationshipRepository } from "../storage/db.js";
import type { KnowledgeGraph } from "../knowledge/graph.js";
import type { PatternAnalyzer } from "../patterns/patternAnalyzer.js";
import type { ArchGuard } from "../governance/archGuard.js";
import type { Reaper } from "../governance/reaper.js";
import { generateProjectStatus, formatProjectStatus } from "./projectStatus.js";

const { values } = parseArgs({
  options: {
    "db-path": { type: "string", default: ".docs-kit/registry.db" },
    "docs-dir": { type: "string", default: "docs" },
  },
});

await setupContainer({ dbPath: values["db-path"]! });

const db = resolve<Database.Database>(DATABASE_TOKEN);

const result = await generateProjectStatus(
  {
    docsDir: values["docs-dir"],
  },
  {
    symbolRepo: resolve<SymbolRepository>(SYMBOL_REPO_TOKEN),
    relRepo: resolve<RelationshipRepository>(RELATIONSHIP_REPO_TOKEN),
    registry: resolve<DocRegistry>(DOC_REGISTRY_TOKEN),
    patternAnalyzer: resolve<PatternAnalyzer>(PATTERN_ANALYZER_TOKEN),
    archGuard: resolve<ArchGuard>(ARCH_GUARD_TOKEN),
    reaper: resolve<Reaper>(REAPER_TOKEN),
    graph: resolve<KnowledgeGraph>(KNOWLEDGE_GRAPH_TOKEN),
  },
);

db.close();

console.log(formatProjectStatus(result));
