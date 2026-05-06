import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import type { ResolvedConfig } from "../../../configLoader.js";
import type { DocRegistry } from "../../../docs/docRegistry.js";
import type { ArchGuard } from "../../../governance/archGuard.js";
import type { Reaper } from "../../../governance/reaper.js";
import { generateExplanationHash } from "../../../handlers/explainSymbol.js";
import type { CodeSymbol, SymbolRelationship } from "../../../indexer/symbol.types.js";
import type { KnowledgeGraph } from "../../../knowledge/graph.js";
import { createRagIndex } from "../../../knowledge/rag.js";
import type { LlmProvider } from "../../../llm/provider.js";
import {
  replaceAllArchViolations,
  replaceAllPatterns,
  replaceAllReaperFindings,
  type PatternRowForInsert,
  type RelationshipRepository,
  type SymbolRepository,
} from "../../../storage/db.js";
import { resolve } from "../../../di/container.js";
import {
  ARCH_GUARD_TOKEN,
  DOC_REGISTRY_TOKEN,
  KNOWLEDGE_GRAPH_TOKEN,
  LLM_PROVIDER_TOKEN,
  REAPER_TOKEN,
} from "../../../di/tokens.js";
import { done, step, isLlmConfigured } from "../../utils/index.js";

export async function persistToDatabase(
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
      preserveFreshExplanation(symbolRepo, symbol, config);
      symbolRepo.upsert(symbol);
    }
  });
  upsertSymbols();

  const upsertRels = db.transaction(() => {
    for (const relationship of relationships) {
      relRepo.upsert(relationship.sourceId, relationship.targetId, relationship.type);
    }
  });
  upsertRels();

  replaceAllPatterns(
    db,
    patterns.map((pattern) => ({
      kind: pattern.kind,
      symbols: pattern.symbols,
      confidence: pattern.confidence,
      violations: pattern.violations,
    })),
  );
  done(dbPath);
}

function preserveFreshExplanation(
  symbolRepo: SymbolRepository,
  symbol: CodeSymbol,
  config: ResolvedConfig,
): void {
  const existingSymbol = symbolRepo.findById(symbol.id);

  if (!existingSymbol?.explanation || !existingSymbol?.explanationHash) {
    return;
  }

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

export async function scanDocs(
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
      for (const mapping of mappings) {
        updateDocRef.run(mapping.doc_path, mapping.symbol_name);
      }
    })();
    done(`${registeredDocsCount} docs, ${docMappingsCount} symbol mappings`);
  }

  return { docMappingsCount, registeredDocsCount };
}

export async function runGovernance(
  db: Database.Database,
  allSymbols: CodeSymbol[],
  relationships: SymbolRelationship[],
  config: ResolvedConfig,
) {
  step("Governance (arch + reaper)");
  const graph = resolve<KnowledgeGraph>(KNOWLEDGE_GRAPH_TOKEN);
  const symRelationships = toSymbolRelationships(relationships);
  const archGuard = resolve<ArchGuard>(ARCH_GUARD_TOKEN);

  if (config.archGuard?.languages && config.archGuard.languages.length > 0) {
    const { buildLanguageGuardResult } =
      await import("../../../governance/languageGuardManager.js");
    const guardResult = buildLanguageGuardResult(config.archGuard);
    archGuard.setRules(guardResult.rules);

    let archViolations = archGuard.analyze(allSymbols, symRelationships);
    archViolations = guardResult.filterViolations(archViolations);

    const reaperFindings = runReaper(db, allSymbols, graph);
    persistGovernanceResults(db, archViolations, reaperFindings);
    reportGovernance(archViolations, reaperFindings);
    return;
  }

  const { buildArchGuardBaseRules } = await import("../../../governance/archGuardBase.js");
  archGuard.setRules(buildArchGuardBaseRules({ languages: ["ts", "js"], metricRules: true }));

  const archViolations = archGuard.analyze(allSymbols, symRelationships);
  const reaperFindings = runReaper(db, allSymbols, graph);
  persistGovernanceResults(db, archViolations, reaperFindings);
  reportGovernance(archViolations, reaperFindings);
}

function toSymbolRelationships(relationships: SymbolRelationship[]): SymbolRelationship[] {
  return relationships.map((relationship) => ({
    sourceId: relationship.sourceId,
    targetId: relationship.targetId,
    type: relationship.type,
    location: relationship.location,
  }));
}

function runReaper(db: Database.Database, allSymbols: CodeSymbol[], graph: KnowledgeGraph) {
  const docMappingsForReaper = (
    db.prepare("SELECT symbol_name, doc_path FROM doc_mappings").all() as Array<{
      symbol_name: string;
      doc_path: string;
    }>
  ).map((mapping) => ({ symbolName: mapping.symbol_name, docPath: mapping.doc_path }));

  const reaper = resolve<Reaper>(REAPER_TOKEN);
  return reaper.scan(allSymbols, graph, docMappingsForReaper);
}

function persistGovernanceResults(
  db: Database.Database,
  archViolations: ReturnType<ArchGuard["analyze"]>,
  reaperFindings: ReturnType<Reaper["scan"]>,
): void {
  replaceAllArchViolations(
    db,
    archViolations.map((violation) => ({
      rule: violation.rule,
      file: violation.file,
      symbol_id: violation.symbolId ?? null,
      message: violation.message,
      severity: violation.severity,
    })),
  );

  replaceAllReaperFindings(
    db,
    reaperFindings.map((finding) => ({
      type: finding.type,
      target: finding.target,
      reason: finding.reason,
      suggested_action: finding.suggestedAction,
    })),
  );
}

function reportGovernance(
  archViolations: ReturnType<ArchGuard["analyze"]>,
  reaperFindings: ReturnType<Reaper["scan"]>,
): void {
  done(`${archViolations.length} arch, ${reaperFindings.length} reaper`);

  if (archViolations.length === 0) return;

  console.log("\n  Arch Guard violations:");
  const maxShow = 15;
  for (let index = 0; index < Math.min(archViolations.length, maxShow); index++) {
    const violation = archViolations[index];
    console.log(
      `    [${violation.severity}] ${violation.rule}: ${violation.message} (${violation.file})`,
    );
  }
  if (archViolations.length > maxShow) {
    console.log(`    ... and ${archViolations.length - maxShow} more`);
  }
}

export async function populateRagIndex(
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
