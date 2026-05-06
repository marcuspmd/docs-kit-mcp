import "reflect-metadata";
import fs from "node:fs";
import path from "node:path";
import Parser from "tree-sitter";
import { configExists, createDefaultConfig, loadConfig } from "../../configLoader.js";
import { setupContainer, resolve } from "../../di/container.js";
import {
  DATABASE_TOKEN,
  FILE_HASH_REPO_TOKEN,
  RELATIONSHIP_REPO_TOKEN,
  SYMBOL_REPO_TOKEN,
} from "../../di/tokens.js";
import type Database from "better-sqlite3";
import type {
  FileHashRepository,
  PatternRowForInsert,
  RelationshipRepository,
  SymbolRepository,
} from "../../storage/db.js";
import type { CodeSymbol, SymbolRelationship } from "../../indexer/symbol.types.js";
import { done, header, step } from "../utils/index.js";
import { resolveConfigPath } from "../utils/index.js";
import {
  collectMetricsPhase,
  detectPatterns,
  extractRelationshipsPhase,
  loadCoverageData,
  populateReferences,
} from "./indexing/analysis.js";
import { cleanupRemovedFiles, findSourceFiles } from "./indexing/files.js";
import {
  persistToDatabase,
  populateRagIndex,
  runGovernance,
  scanDocs,
} from "./indexing/persistence.js";
import { reportSummary } from "./indexing/summary.js";
import { indexSymbols, reportIndexErrors } from "./indexing/symbols.js";

/**
 * Index command - Scan source files, extract symbols, relationships, metrics
 */
export interface IndexUseCaseParams {
  rootDir?: string;
  dbPath?: string;
  docsDir?: string;
  fullRebuild?: boolean;
}

export async function indexUseCase(params: IndexUseCaseParams): Promise<void> {
  const { fullRebuild = false } = params;

  const configDir = process.cwd();

  if (!configExists(configDir)) {
    const configPath = createDefaultConfig(configDir);
    console.log(`  No docs.config.js found. Created ${configPath} with defaults.\n`);
  }

  const config = await loadConfig(configDir);
  const rootDir = params.rootDir ?? config.rootDir;
  const dbPath = resolveConfigPath(params.dbPath, configDir, config.dbPath);
  const docsDir = params.docsDir || "docs";

  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  await setupContainer({ cwd: configDir, dbPath });

  const db = resolve<Database.Database>(DATABASE_TOKEN);
  const symbolRepo = resolve<SymbolRepository>(SYMBOL_REPO_TOKEN);
  const relRepo = resolve<RelationshipRepository>(RELATIONSHIP_REPO_TOKEN);
  const fileHashRepo = resolve<FileHashRepository>(FILE_HASH_REPO_TOKEN);

  let tsFiles: string[] = [];
  let allSymbols: CodeSymbol[] = [];
  let relationships: SymbolRelationship[] = [];
  let patterns: PatternRowForInsert[] = [];
  let registeredDocsCount = 0;
  let docMappingsCount = 0;

  try {
    header(`Indexing ${path.resolve(rootDir)}`);

    const parser = new Parser();

    if (fullRebuild) {
      step("Full rebuild requested — clearing hashes");
      fileHashRepo.clear();
      done();
    }

    const sourceFiles = await findSourceFiles(config, rootDir);
    tsFiles = sourceFiles.tsFiles;

    await cleanupRemovedFiles(
      fileHashRepo,
      symbolRepo,
      relRepo,
      sourceFiles.relativeFiles,
      configDir,
      rootDir,
    );

    const indexResult = await indexSymbols(
      tsFiles,
      configDir,
      symbolRepo,
      fileHashRepo,
      parser,
      fullRebuild,
      config,
    );
    allSymbols = indexResult.allSymbols;

    reportIndexErrors(indexResult.indexErrors);

    relationships = await extractRelationshipsPhase(
      allSymbols,
      indexResult.trees,
      indexResult.sources,
    );
    populateReferences(allSymbols, relationships);

    const coverageData = await loadCoverageData(config, configDir);
    await collectMetricsPhase(allSymbols, indexResult.trees, coverageData, configDir);

    patterns = await detectPatterns(allSymbols, relationships);

    await persistToDatabase(
      db,
      symbolRepo,
      relRepo,
      allSymbols,
      relationships,
      patterns,
      fullRebuild,
      config,
      dbPath,
    );

    const docScan = await scanDocs(db, docsDir, configDir, config);
    docMappingsCount = docScan.docMappingsCount;
    registeredDocsCount = docScan.registeredDocsCount;

    await runGovernance(db, allSymbols, relationships, config);
    await populateRagIndex(db, config, allSymbols, indexResult.sources, docsDir, configDir);
  } finally {
    db.close();
  }

  reportSummary(
    tsFiles,
    allSymbols,
    relationships,
    patterns,
    registeredDocsCount,
    docMappingsCount,
    dbPath,
  );
}
