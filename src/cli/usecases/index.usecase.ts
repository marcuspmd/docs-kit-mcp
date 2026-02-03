import "reflect-metadata";
import fs from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import Parser from "tree-sitter";
import {
  configExists,
  createDefaultConfig,
  loadConfig,
  type ResolvedConfig,
} from "../../configLoader.js";
import { setupContainer, resolve } from "../../di/container.js";
import {
  DATABASE_TOKEN,
  CONFIG_TOKEN,
  SYMBOL_REPO_TOKEN,
  RELATIONSHIP_REPO_TOKEN,
  FILE_HASH_REPO_TOKEN,
  DOC_REGISTRY_TOKEN,
  KNOWLEDGE_GRAPH_TOKEN,
  PATTERN_ANALYZER_TOKEN,
  ARCH_GUARD_TOKEN,
  REAPER_TOKEN,
  LLM_PROVIDER_TOKEN,
  RAG_INDEX_TOKEN,
} from "../../di/tokens.js";
import {
  initializeSchema,
  replaceAllPatterns,
  replaceAllArchViolations,
  replaceAllReaperFindings,
  type SymbolRepository,
  type RelationshipRepository,
  type FileHashRepository,
  type PatternRowForInsert,
} from "../../storage/db.js";
import type Database from "better-sqlite3";
import type { DocRegistry } from "../../docs/docRegistry.js";
import type { KnowledgeGraph } from "../../knowledge/graph.js";
import type { PatternAnalyzer } from "../../patterns/patternAnalyzer.js";
import type { ArchGuard } from "../../governance/archGuard.js";
import type { Reaper } from "../../governance/reaper.js";
import type { LlmProvider } from "../../llm/provider.js";
import type { RagIndex } from "../../knowledge/rag.js";
import { indexFile } from "../../indexer/indexer.js";
import { extractRelationships } from "../../indexer/relationshipExtractor.js";
import { parseLcov, type LcovFileData } from "../../indexer/lcovCollector.js";
import { collectMetrics } from "../../indexer/metricsCollector.js";
import { createRagIndex } from "../../knowledge/rag.js";
import { generateExplanationHash } from "../../handlers/explainSymbol.js";
import type { CodeSymbol, SymbolRelationship } from "../../indexer/symbol.types.js";
import { header, step, done, summary } from "../utils/index.js";
import { resolveConfigPath, isLlmConfigured } from "../utils/index.js";

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
  const { rootDir = ".", fullRebuild = false } = params;

  const configDir = process.cwd();

  if (!configExists(configDir)) {
    const configPath = createDefaultConfig(configDir);
    console.log(`  No docs.config.js found. Created ${configPath} with defaults.\n`);
  }

  const config = await loadConfig(configDir);
  const dbPath = resolveConfigPath(params.dbPath, configDir, config.dbPath);
  const docsDir = params.docsDir || "docs";

  // Ensure db directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  await setupContainer({ cwd: configDir, dbPath });

  const db = resolve<Database.Database>(DATABASE_TOKEN);
  const symbolRepo = resolve<SymbolRepository>(SYMBOL_REPO_TOKEN);
  const relRepo = resolve<RelationshipRepository>(RELATIONSHIP_REPO_TOKEN);
  const fileHashRepo = resolve<FileHashRepository>(FILE_HASH_REPO_TOKEN);

  header(`Indexing ${path.resolve(rootDir)}`);

  const parser = new Parser();

  if (fullRebuild) {
    step("Full rebuild requested — clearing hashes");
    fileHashRepo.clear();
    done();
  }

  // Phase 1: Find source files
  const { tsFiles, relativeFiles } = await findSourceFiles(config, rootDir, configDir);

  // Phase 2: Detect and remove stale files
  await cleanupRemovedFiles(fileHashRepo, symbolRepo, relRepo, relativeFiles, configDir, rootDir);

  // Phase 3: Index symbols
  const { allSymbols, trees, sources, indexErrors } = await indexSymbols(
    tsFiles,
    configDir,
    symbolRepo,
    fileHashRepo,
    parser,
    fullRebuild,
    config,
  );

  reportIndexErrors(indexErrors, configDir);

  // Phase 4: Extract relationships
  const relationships = await extractRelationshipsPhase(allSymbols, trees, sources);

  // Phase 5: Populate references
  populateReferences(allSymbols, relationships);

  // Phase 6: Load coverage
  const coverageData = await loadCoverageData(config, configDir);

  // Phase 7: Collect metrics
  await collectMetricsPhase(allSymbols, trees, coverageData, configDir);

  // Phase 8: Detect patterns
  const patterns = await detectPatterns(allSymbols, relationships);

  // Phase 9: Persist to SQLite
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

  // Phase 10: Scan docs
  const { docMappingsCount, registeredDocsCount } = await scanDocs(db, docsDir, configDir, config);

  // Phase 11: Governance
  await runGovernance(db, allSymbols, relationships, config);

  // Phase 12: RAG indexing
  await populateRagIndex(db, config, allSymbols, sources, docsDir, configDir);

  db.close();

  // Report summary
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

/* ================== Helper Functions ================== */

async function findSourceFiles(config: ResolvedConfig, rootDir: string, _configDir: string) {
  step("Scanning for source files");
  const relativeFiles = await fg(config.include, {
    cwd: path.resolve(rootDir),
    ignore: config.exclude,
    absolute: false,
  });
  const tsFiles = relativeFiles.map((f) => path.join(rootDir, f));
  done(`found ${tsFiles.length} files`);
  return { tsFiles, relativeFiles };
}

async function cleanupRemovedFiles(
  fileHashRepo: FileHashRepository,
  symbolRepo: SymbolRepository,
  relRepo: RelationshipRepository,
  relativeFiles: string[],
  configDir: string,
  rootDir: string,
) {
  const knownFiles = fileHashRepo.getAll();
  const currentFileSet = new Set(
    relativeFiles.map((f) => path.relative(configDir, path.resolve(rootDir, f))),
  );
  const removedFiles: string[] = [];

  for (const { filePath: knownPath } of knownFiles) {
    if (!currentFileSet.has(knownPath)) {
      removedFiles.push(knownPath);
      symbolRepo.deleteByFile(knownPath);
      relRepo.deleteBySource(knownPath);
      relRepo.deleteBySource(`module::${knownPath}`);
      fileHashRepo.delete(knownPath);
    }
  }

  if (removedFiles.length > 0) {
    console.log(`  -> Removed ${removedFiles.length} stale files from index`);
  }
}

async function indexSymbols(
  tsFiles: string[],
  configDir: string,
  symbolRepo: SymbolRepository,
  fileHashRepo: FileHashRepository,
  parser: Parser,
  fullRebuild: boolean,
  _config: ResolvedConfig,
) {
  step("Parsing AST and extracting symbols");
  const allSymbols: CodeSymbol[] = [];
  const trees = new Map<string, Parser.Tree>();
  const sources = new Map<string, string>();
  let errorCount = 0;
  let skippedCount = 0;
  const indexErrors: Array<{ file: string; error: string }> = [];
  const { createHash } = await import("node:crypto");

  for (const filePath of tsFiles) {
    try {
      const source = fs.readFileSync(filePath, "utf-8");
      const relPath = path.relative(configDir, path.resolve(filePath));

      // Incremental: skip unchanged files
      if (!fullRebuild) {
        const hash = createHash("sha256").update(source).digest("hex");
        const existing = fileHashRepo.get(relPath);
        if (existing && existing.contentHash === hash) {
          skippedCount++;
          const existingSymbols = symbolRepo.findByFile(relPath);
          allSymbols.push(...existingSymbols);
          continue;
        }
        fileHashRepo.upsert(relPath, hash);
      } else {
        const hash = createHash("sha256").update(source).digest("hex");
        fileHashRepo.upsert(relPath, hash);
      }

      // Delete old symbols for this file before re-indexing
      symbolRepo.deleteByFile(relPath);

      const symbols = indexFile(relPath, source, parser);
      const tree = parser.parse(source);
      trees.set(relPath, tree);
      sources.set(relPath, source);
      const stat = fs.statSync(filePath);
      for (const sym of symbols) {
        sym.lastModified = stat.mtime;
        sym.source = "human";
      }
      allSymbols.push(...symbols);
    } catch (err) {
      errorCount++;
      const msg = err instanceof Error ? err.message : String(err);
      const rel = path.relative(configDir, path.resolve(filePath));
      indexErrors.push({ file: rel, error: msg });
    }
  }

  const skipMsg = skippedCount > 0 ? ` (${skippedCount} unchanged, skipped)` : "";
  done(`${allSymbols.length} symbols${errorCount > 0 ? ` (${errorCount} errors)` : ""}${skipMsg}`);

  return { allSymbols, trees, sources, indexErrors };
}

function reportIndexErrors(
  indexErrors: Array<{ file: string; error: string }>,
  _configDir: string,
) {
  if (indexErrors.length === 0) return;

  const grouped = new Map<string, string[]>();
  for (const { file, error } of indexErrors) {
    const list = grouped.get(error) ?? [];
    list.push(file);
    grouped.set(error, list);
  }

  console.error(`\n  Index errors (${indexErrors.length} files):`);
  for (const [error, files] of grouped) {
    console.error(`    [${files.length}x] ${error}`);
    for (const f of files.slice(0, 5)) {
      console.error(`         ${f}`);
    }
    if (files.length > 5) {
      console.error(`         ... and ${files.length - 5} more`);
    }
  }
  console.error();
}

async function extractRelationshipsPhase(
  allSymbols: CodeSymbol[],
  trees: Map<string, Parser.Tree>,
  sources: Map<string, string>,
) {
  step("Extracting relationships");
  const relationships = extractRelationships({
    symbols: allSymbols,
    trees,
    sources,
  });
  done(`${relationships.length} relationships`);
  return relationships;
}

function populateReferences(allSymbols: CodeSymbol[], relationships: SymbolRelationship[]) {
  const symbolById = new Map(allSymbols.map((s) => [s.id, s]));
  for (const rel of relationships) {
    const src = symbolById.get(rel.sourceId);
    const tgt = symbolById.get(rel.targetId);
    if (src) {
      if (!src.references) src.references = [];
      if (!src.references.includes(rel.targetId)) src.references.push(rel.targetId);
    }
    if (tgt) {
      if (!tgt.referencedBy) tgt.referencedBy = [];
      if (!tgt.referencedBy.includes(rel.sourceId)) tgt.referencedBy.push(rel.sourceId);
    }
  }
}

async function loadCoverageData(
  config: ResolvedConfig,
  configDir: string,
): Promise<LcovFileData[] | undefined> {
  let coverageData: LcovFileData[] | undefined;
  if (config.coverage?.enabled) {
    const lcovPath = path.resolve(configDir, config.coverage.lcovPath);
    if (fs.existsSync(lcovPath)) {
      step("Loading test coverage data");
      try {
        coverageData = await parseLcov(lcovPath);
        done(`loaded from ${config.coverage.lcovPath}`);
      } catch (err) {
        console.warn(
          `  ⚠ Failed to parse lcov file: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } else {
      console.warn(`  ⚠ Coverage enabled but lcov file not found: ${config.coverage.lcovPath}`);
    }
  }
  return coverageData;
}

async function collectMetricsPhase(
  allSymbols: CodeSymbol[],
  trees: Map<string, Parser.Tree>,
  coverageData: LcovFileData[] | undefined,
  projectRoot: string,
) {
  step("Computing metrics");
  const updatedSymbols = collectMetrics({
    symbols: allSymbols,
    trees,
    coverage: coverageData,
    projectRoot,
  });
  allSymbols.splice(0, allSymbols.length, ...updatedSymbols);
  done();
}

async function detectPatterns(
  allSymbols: CodeSymbol[],
  relationships: SymbolRelationship[],
): Promise<PatternRowForInsert[]> {
  step("Detecting patterns");
  const patternAnalyzer = resolve<PatternAnalyzer>(PATTERN_ANALYZER_TOKEN);
  const symRelationships: SymbolRelationship[] = relationships.map((r) => ({
    sourceId: r.sourceId,
    targetId: r.targetId,
    type: r.type,
    location: r.location,
  }));
  const patterns = patternAnalyzer.analyze(allSymbols, symRelationships);

  for (const pattern of patterns) {
    for (const symbolId of pattern.symbols) {
      const sym = allSymbols.find((s) => s.id === symbolId);
      if (sym) {
        sym.pattern = pattern.kind;
      }
    }
  }
  done(`${patterns.length} patterns`);
  return patterns;
}

async function persistToDatabase(
  db: Database.Database,
  symbolRepo: SymbolRepository,
  relRepo: RelationshipRepository,
  allSymbols: CodeSymbol[],
  relationships: SymbolRelationship[],
  patterns: PatternRowForInsert[],
  fullRebuild: boolean,
  config: ResolvedConfig,
  dbPath: string,
) {
  step("Persisting to SQLite");

  if (fullRebuild) {
    db.prepare("DELETE FROM symbols").run();
    db.prepare("DELETE FROM relationships").run();
  }

  const upsertSymbols = db.transaction(() => {
    for (const symbol of allSymbols) {
      const existingSymbol = symbolRepo.findById(symbol.id);

      if (existingSymbol?.explanation && existingSymbol?.explanationHash) {
        try {
          const filePath = path.resolve(config.projectRoot, symbol.file);
          const fullSource = fs.readFileSync(filePath, "utf-8");
          const lines = fullSource.split("\n").slice(symbol.startLine - 1, symbol.endLine);
          const sourceCode = lines.join("\n");
          const currentHash = generateExplanationHash(
            symbol.id,
            symbol.startLine,
            symbol.endLine,
            sourceCode,
          );

          if (currentHash !== existingSymbol.explanationHash) {
            symbol.explanation = undefined;
            symbol.explanationHash = undefined;
          } else {
            symbol.explanation = existingSymbol.explanation;
            symbol.explanationHash = existingSymbol.explanationHash;
          }
        } catch {
          symbol.explanation = undefined;
          symbol.explanationHash = undefined;
        }
      }

      symbolRepo.upsert(symbol);
    }
  });
  upsertSymbols();

  const upsertRels = db.transaction(() => {
    for (const rel of relationships) {
      relRepo.upsert(rel.sourceId, rel.targetId, rel.type);
    }
  });
  upsertRels();

  replaceAllPatterns(
    db,
    patterns.map((p) => ({
      kind: p.kind,
      symbols: p.symbols,
      confidence: p.confidence,
      violations: p.violations,
    })),
  );
  done(dbPath);
}

async function scanDocs(
  db: Database.Database,
  docsDir: string,
  configDir: string,
  config: ResolvedConfig,
) {
  let docMappingsCount = 0;
  let registeredDocsCount = 0;
  const docsPath = path.resolve(configDir, docsDir);

  if (fs.existsSync(docsPath)) {
    step("Scanning docs for symbol mappings");
    const registry = resolve<DocRegistry>(DOC_REGISTRY_TOKEN);
    await registry.rebuild(docsPath, { configDocs: config.docs });

    const updateDocRef = db.prepare("UPDATE symbols SET doc_ref = ? WHERE name = ?");
    const getMappings = db.prepare("SELECT symbol_name, doc_path FROM doc_mappings");
    const mappings = getMappings.all() as Array<{ symbol_name: string; doc_path: string }>;
    docMappingsCount = mappings.length;
    registeredDocsCount = registry.findAllDocs().length;

    db.transaction(() => {
      for (const m of mappings) {
        updateDocRef.run(m.doc_path, m.symbol_name);
      }
    })();
    done(`${registeredDocsCount} docs, ${docMappingsCount} symbol mappings`);
  }

  return { docMappingsCount, registeredDocsCount };
}

async function runGovernance(
  db: Database.Database,
  allSymbols: CodeSymbol[],
  relationships: SymbolRelationship[],
  config: ResolvedConfig,
) {
  step("Governance (arch + reaper)");
  const graph = resolve<KnowledgeGraph>(KNOWLEDGE_GRAPH_TOKEN);
  const symRelationships: SymbolRelationship[] = relationships.map((r) => ({
    sourceId: r.sourceId,
    targetId: r.targetId,
    type: r.type,
    location: r.location,
  }));
  const archGuard = resolve<ArchGuard>(ARCH_GUARD_TOKEN);

  // Use new language-specific guard system if languages are configured
  if (config.archGuard?.languages && config.archGuard.languages.length > 0) {
    const { buildLanguageGuardResult } = await import("../../governance/languageGuardManager.js");
    const guardResult = buildLanguageGuardResult(config.archGuard);
    archGuard.setRules(guardResult.rules);

    // Run analysis and filter by ignorePaths
    let archViolations = archGuard.analyze(allSymbols, symRelationships);
    archViolations = guardResult.filterViolations(archViolations);

    replaceAllArchViolations(
      db,
      archViolations.map((v) => ({
        rule: v.rule,
        file: v.file,
        symbol_id: v.symbolId ?? null,
        message: v.message,
        severity: v.severity,
      })),
    );

    // Run reaper
    const docMappingsForReaper = (
      db.prepare("SELECT symbol_name, doc_path FROM doc_mappings").all() as Array<{
        symbol_name: string;
        doc_path: string;
      }>
    ).map((m) => ({ symbolName: m.symbol_name, docPath: m.doc_path }));

    const reaper = resolve<Reaper>(REAPER_TOKEN);
    const reaperFindings = reaper.scan(allSymbols, graph, docMappingsForReaper);
    replaceAllReaperFindings(
      db,
      reaperFindings.map((f) => ({
        type: f.type,
        target: f.target,
        reason: f.reason,
        suggested_action: f.suggestedAction,
      })),
    );
    done(`${archViolations.length} arch, ${reaperFindings.length} reaper`);

    if (archViolations.length > 0) {
      console.log("\n  Arch Guard violations:");
      const maxShow = 15;
      for (let i = 0; i < Math.min(archViolations.length, maxShow); i++) {
        const v = archViolations[i];
        console.log(`    [${v.severity}] ${v.rule}: ${v.message} (${v.file})`);
      }
      if (archViolations.length > maxShow) {
        console.log(`    ... and ${archViolations.length - maxShow} more`);
      }
    }
    return;
  }

  // Fallback: use legacy buildArchGuardBaseRules (for backwards compatibility during transition)
  const { buildArchGuardBaseRules } = await import("../../governance/archGuardBase.js");
  archGuard.setRules(buildArchGuardBaseRules({ languages: ["ts", "js"], metricRules: true }));

  const archViolations = archGuard.analyze(allSymbols, symRelationships);
  replaceAllArchViolations(
    db,
    archViolations.map((v) => ({
      rule: v.rule,
      file: v.file,
      symbol_id: v.symbolId ?? null,
      message: v.message,
      severity: v.severity,
    })),
  );

  const docMappingsForReaper = (
    db.prepare("SELECT symbol_name, doc_path FROM doc_mappings").all() as Array<{
      symbol_name: string;
      doc_path: string;
    }>
  ).map((m) => ({ symbolName: m.symbol_name, docPath: m.doc_path }));

  const reaper = resolve<Reaper>(REAPER_TOKEN);
  const reaperFindings = reaper.scan(allSymbols, graph, docMappingsForReaper);
  replaceAllReaperFindings(
    db,
    reaperFindings.map((f) => ({
      type: f.type,
      target: f.target,
      reason: f.reason,
      suggested_action: f.suggestedAction,
    })),
  );
  done(`${archViolations.length} arch, ${reaperFindings.length} reaper`);

  if (archViolations.length > 0) {
    console.log("\n  Arch Guard violations:");
    const maxShow = 15;
    for (let i = 0; i < Math.min(archViolations.length, maxShow); i++) {
      const v = archViolations[i];
      console.log(`    [${v.severity}] ${v.rule}: ${v.message} (${v.file})`);
    }
    if (archViolations.length > maxShow) {
      console.log(`    ... and ${archViolations.length - maxShow} more`);
    }
  }
}

async function populateRagIndex(
  db: Database.Database,
  config: ResolvedConfig,
  allSymbols: CodeSymbol[],
  sources: Map<string, string>,
  docsDir: string,
  configDir: string,
) {
  const canEmbed = isLlmConfigured(config);
  const ragEnabled = config.rag?.enabled ?? false;

  if (canEmbed && ragEnabled) {
    step("Populating RAG index");
    try {
      const llm = resolve<LlmProvider>(LLM_PROVIDER_TOKEN);
      const ragIndex = createRagIndex({
        embeddingModel: config.llm.embeddingModel ?? "text-embedding-ada-002",
        db,
        embedFn: (texts: string[]) => llm.embed(texts),
        chunkSize: config.rag?.chunkSize,
        overlapSize: config.rag?.overlapSize,
      });
      await ragIndex.indexSymbols(allSymbols, sources);
      const docsPath = path.resolve(configDir, docsDir);
      if (fs.existsSync(docsPath)) {
        await ragIndex.indexDocs(docsPath);
      }
      done(`${ragIndex.chunkCount()} chunks`);
    } catch (err) {
      done(`skipped (${(err as Error).message})`);
    }
  }
}

function reportSummary(
  tsFiles: string[],
  allSymbols: CodeSymbol[],
  relationships: SymbolRelationship[],
  patterns: PatternRowForInsert[],
  registeredDocsCount: number,
  docMappingsCount: number,
  dbPath: string,
) {
  const kindCounts: Record<string, number> = {};
  for (const s of allSymbols) {
    kindCounts[s.kind] = (kindCounts[s.kind] ?? 0) + 1;
  }

  header("Index Summary");
  summary([
    ["Files", tsFiles.length],
    ["Symbols", allSymbols.length],
    ...Object.entries(kindCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([kind, count]) => [`  ${kind}`, count] as [string, number]),
    ["Relationships", relationships.length],
    ["Patterns", patterns.length],
    ["Registered docs", registeredDocsCount],
    ["Symbol mappings", docMappingsCount],
    ["Database", dbPath],
  ]);
  console.log();
}
