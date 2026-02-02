#!/usr/bin/env node

import { parseArgs } from "node:util";
import Database from "better-sqlite3";
import { dirname } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { generateProjectStatus, formatProjectStatus } from "./projectStatus.js";
import { createDocRegistry } from "../docs/docRegistry.js";
import { createSymbolRepository, createRelationshipRepository } from "../storage/db.js";
import { createKnowledgeGraph } from "../knowledge/graph.js";
import { createPatternAnalyzer } from "../patterns/patternAnalyzer.js";
import { createArchGuard } from "../governance/archGuard.js";
import { createReaper } from "../governance/reaper.js";

const { values } = parseArgs({
  options: {
    "db-path": { type: "string", default: ".docs-kit/registry.db" },
    "docs-dir": { type: "string", default: "docs" },
  },
});

// Garante que o diretório do banco existe
const dbPath = values["db-path"]!;
const dbDir = dirname(dbPath);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}
const db = new Database(dbPath);

const registry = createDocRegistry(db);
const symbolRepo = createSymbolRepository(db);
const relRepo = createRelationshipRepository(db);
const graph = createKnowledgeGraph(db);
const patternAnalyzer = createPatternAnalyzer();
const archGuard = createArchGuard();
const reaper = createReaper();

const result = await generateProjectStatus(
  {
    docsDir: values["docs-dir"],
  },
  {
    symbolRepo,
    relRepo,
    registry,
    patternAnalyzer,
    archGuard,
    reaper,
    graph,
  },
);

db.close();

console.log(formatProjectStatus(result));
