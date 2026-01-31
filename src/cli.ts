#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import Database from "better-sqlite3";
import Parser from "tree-sitter";
import { createDocRegistry } from "./docs/docRegistry.js";
import { indexFile } from "./indexer/indexer.js";
import { extractRelationships } from "./indexer/relationshipExtractor.js";
import { collectMetrics } from "./indexer/metricsCollector.js";
import { createPatternAnalyzer } from "./patterns/patternAnalyzer.js";
import {
  initializeSchema,
  createSymbolRepository,
  createRelationshipRepository,
  createFileHashRepository,
} from "./storage/db.js";
import { loadConfig, configExists, createDefaultConfig } from "./configLoader.js";
import fg from "fast-glob";
import { generateSite } from "./site/generator.js";
import { generateDocs } from "./site/mdGenerator.js";
import { generateProjectStatus, formatProjectStatus } from "./governance/projectStatus.js";
import { performSmartCodeReview } from "./governance/smartCodeReview.js";
import { createCodeExampleValidator } from "./docs/codeExampleValidator.js";
import { createKnowledgeGraph } from "./knowledge/graph.js";
import { createArchGuard } from "./governance/archGuard.js";
import { createReaper } from "./governance/reaper.js";
import type { CodeSymbol, SymbolRelationship } from "./indexer/symbol.types.js";

/* ================== Helpers ================== */

function step(msg: string) {
  process.stdout.write(`  -> ${msg}...`);
}

function done(detail?: string) {
  console.log(detail ? ` ${detail}` : " done");
}

function header(title: string) {
  console.log(`\n${"=".repeat(50)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(50)}\n`);
}

function summary(lines: [string, string | number][]) {
  const maxLabel = Math.max(...lines.map(([l]) => l.length));
  for (const [label, value] of lines) {
    console.log(`  ${label.padEnd(maxLabel)}  ${value}`);
  }
}

/* ================== Main ================== */

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "init":
      runInit(args.slice(1));
      break;
    case "index":
      await runIndex(args.slice(1));
      break;
    case "build-site":
      runBuildSite(args.slice(1));
      break;
    case "build-docs":
      runBuildDocs(args.slice(1));
      break;
    case "generate-repo-docs":
      await generateRepoDocumentation(
        args[1] || ".",
        args[2] || "docs",
        args[3] || ".doc-kit/registry.db",
        (args[4] || "node_modules,dist,.git,docs,tests,.doc-kit").split(",").map((d) => d.trim()),
      );
      break;
    case "project-status":
      await runProjectStatus(args.slice(1));
      break;
    case "smart-code-review":
      await runSmartCodeReview(args.slice(1));
      break;
    case "dead-code":
      await runDeadCodeScan(args.slice(1));
      break;
      printHelp();
      process.exit(command === "--help" || command === "-h" ? 0 : 1);
  }
}

function printHelp() {
  console.log(`doc-kit - Intelligent documentation agent

Usage:
  doc-kit init [dir]                                    Create docs.config.js with defaults
  doc-kit index [dir] [--db path] [--docs dir] [--full]
                                                        Index repository (incremental by default)
  doc-kit build-site [--out dir] [--db path] [--root dir]
                                                        Generate static HTML site
  doc-kit build-docs [--out dir] [--db path] [--root dir]
                                                        Generate Markdown documentation
  doc-kit generate-repo-docs [repo-dir] [docs-dir]     Generate markdown docs
  doc-kit project-status [--db path] [--docs dir]      Generate project status report
  doc-kit smart-code-review [--db path] [--docs dir] [--no-examples]
                                                        Perform comprehensive code review
  doc-kit dead-code [--db path] [--docs dir]            Scan and mark dead code in database
  doc-kit --help                                        Show this help

Commands:
  init               Create docs.config.js with default settings
  index              Scan source files, extract symbols, relationships, metrics
  build-site         Generate navigable HTML documentation from index
  build-docs         Generate structured Markdown documentation from index
  generate-repo-docs Create markdown doc stubs for undocumented symbols
  project-status     Generate comprehensive project status report
  smart-code-review  Perform comprehensive code review with multiple analyses
`);
}

function parseArgs(
  args: string[],
  flags: Record<string, string>,
): { positional: string[]; flags: Record<string, string> } {
  const positional: string[] = [];
  const result = { ...flags };
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      // Check if next arg exists and doesn't start with --
      if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
        result[key] = args[++i];
      } else {
        // Boolean flag - set to empty string to indicate presence
        result[key] = "";
      }
    } else {
      positional.push(args[i]);
    }
  }
  return { positional, flags: result };
}

/* ================== init command ================== */

function runInit(args: string[]) {
  const rootDir = args[0] || ".";

  if (configExists(rootDir)) {
    console.log("  docs.config.js already exists, skipping.");
    return;
  }

  const configPath = createDefaultConfig(rootDir);
  console.log(`  Created ${configPath}`);
  console.log("  Edit it to customize include/exclude patterns and other settings.");
}

/* ================== index command ================== */

async function runIndex(args: string[]) {
  const { positional, flags } = parseArgs(args, {
    db: "",
    docs: "",
    full: undefined as unknown as string,
  });

  const rootDir = positional[0] || ".";
  const fullRebuild = "full" in flags;

  if (!configExists(rootDir)) {
    const configPath = createDefaultConfig(rootDir);
    console.log(`  No docs.config.js found. Created ${configPath} with defaults.\n`);
  }

  const config = await loadConfig(rootDir);
  const dbPath = flags.db || config.dbPath;
  const docsDir = flags.docs || "docs";

  header(`Indexing ${path.resolve(rootDir)}`);

  // Ensure db directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(dbPath);
  initializeSchema(db);

  const symbolRepo = createSymbolRepository(db);
  const relRepo = createRelationshipRepository(db);
  const fileHashRepo = createFileHashRepository(db);

  const parser = new Parser();

  if (fullRebuild) {
    step("Full rebuild requested — clearing hashes");
    fileHashRepo.clear();
    done();
  }

  // Find source files using config include/exclude patterns
  step("Scanning for source files");
  const relativeFiles = await fg(config.include, {
    cwd: path.resolve(rootDir),
    ignore: config.exclude,
    absolute: false,
  });
  const tsFiles = relativeFiles.map((f) => path.join(rootDir, f));
  done(`found ${tsFiles.length} files`);

  // Detect removed files and clean up
  const knownFiles = fileHashRepo.getAll();
  const currentFileSet = new Set(relativeFiles);
  const removedFiles: string[] = [];
  for (const { filePath: knownPath } of knownFiles) {
    if (!currentFileSet.has(knownPath)) {
      removedFiles.push(knownPath);
      symbolRepo.deleteByFile(knownPath);
      relRepo.deleteBySource(knownPath);
      fileHashRepo.delete(knownPath);
    }
  }
  if (removedFiles.length > 0) {
    console.log(`  -> Removed ${removedFiles.length} stale files from index`);
  }

  // Phase 1: Index symbols + collect AST trees
  step("Parsing AST and extracting symbols");
  let allSymbols: CodeSymbol[] = [];
  const trees = new Map<string, Parser.Tree>();
  const sources = new Map<string, string>();
  let errorCount = 0;
  let skippedCount = 0;
  const indexErrors: Array<{ file: string; error: string }> = [];
  const { createHash } = await import("node:crypto");

  for (const filePath of tsFiles) {
    try {
      const source = fs.readFileSync(filePath, "utf-8");
      const relPath = path.relative(rootDir, filePath);

      // Incremental: skip unchanged files
      if (!fullRebuild) {
        const hash = createHash("sha256").update(source).digest("hex");
        const existing = fileHashRepo.get(relPath);
        if (existing && existing.contentHash === hash) {
          skippedCount++;
          // Load existing symbols from DB for relationship extraction
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
      const rel = path.relative(rootDir, filePath);
      indexErrors.push({ file: rel, error: msg });
    }
  }
  const skipMsg = skippedCount > 0 ? ` (${skippedCount} unchanged, skipped)` : "";
  done(`${allSymbols.length} symbols${errorCount > 0 ? ` (${errorCount} errors)` : ""}${skipMsg}`);

  if (indexErrors.length > 0) {
    // Group errors by message to avoid flooding the output
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

  // Phase 2: Extract relationships
  step("Extracting relationships");
  const relationships = extractRelationships({
    symbols: allSymbols,
    trees,
    sources,
  });
  done(`${relationships.length} relationships`);

  // Populate references / referencedBy on symbols
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

  // Phase 3: Collect metrics
  step("Computing metrics");
  allSymbols = collectMetrics({ symbols: allSymbols, trees });
  done();

  // Phase 4: Detect patterns
  step("Detecting patterns");
  const patternAnalyzer = createPatternAnalyzer();
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

  // Phase 5: Persist to SQLite
  step("Persisting to SQLite");

  if (fullRebuild) {
    db.prepare("DELETE FROM symbols").run();
    db.prepare("DELETE FROM relationships").run();
  }

  const upsertSymbols = db.transaction(() => {
    for (const symbol of allSymbols) {
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
  done(dbPath);

  // Phase 6: Scan docs and populate doc_mappings
  let docMappingsCount = 0;
  const docsPath = path.resolve(rootDir, docsDir);
  if (fs.existsSync(docsPath)) {
    step("Scanning docs for symbol mappings");
    const registry = createDocRegistry(db);
    await registry.rebuild(docsDir);

    // Link symbols to their docs via docRef
    const updateDocRef = db.prepare("UPDATE symbols SET doc_ref = ? WHERE name = ?");
    const getMappings = db.prepare("SELECT symbol_name, doc_path FROM doc_mappings");
    const mappings = getMappings.all() as Array<{ symbol_name: string; doc_path: string }>;
    docMappingsCount = mappings.length;

    db.transaction(() => {
      for (const m of mappings) {
        updateDocRef.run(m.doc_path, m.symbol_name);
      }
    })();
    done(`${docMappingsCount} mappings`);
  }

  // Phase 7: Auto-populate RAG index
  {
    const canEmbed =
      config.llm.provider === "ollama" ||
      (config.llm.provider === "openai" && process.env.OPENAI_API_KEY) ||
      (config.llm.provider === "gemini" && (config.llm.apiKey || process.env.GEMINI_API_KEY)) ||
      (config.llm.provider === "claude" && process.env.VOYAGE_API_KEY);

    if (canEmbed) {
      step("Populating RAG index");
      try {
        const { createLlmProvider } = await import("./llm/provider.js");
        const { createRagIndex } = await import("./knowledge/rag.js");
        const llm = createLlmProvider(config);
        const ragIndex = createRagIndex({
          embeddingModel: config.llm.embeddingModel ?? "text-embedding-ada-002",
          db,
          embedFn: (texts: string[]) => llm.embed(texts),
        });
        await ragIndex.indexSymbols(allSymbols, sources);
        if (fs.existsSync(docsPath)) {
          await ragIndex.indexDocs(docsDir);
        }
        done(`${ragIndex.chunkCount()} chunks`);
      } catch (err) {
        done(`skipped (${(err as Error).message})`);
      }
    }
  }

  db.close();

  // Report
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
    ["Doc mappings", docMappingsCount],
    ["Database", dbPath],
  ]);
  console.log();
}

/* ================== build-site command ================== */

function runBuildSite(args: string[]) {
  const { flags } = parseArgs(args, {
    out: "doc-site",
    db: ".doc-kit/index.db",
    root: ".",
  });

  const dbPath = flags.db;
  const outDir = flags.out;
  const rootDir = flags.root;

  if (!fs.existsSync(dbPath)) {
    console.error(`Error: Database not found at ${dbPath}`);
    console.error(`Run "doc-kit index" first to create the index.`);
    process.exit(1);
  }

  header(`Generating site: ${outDir}/`);

  step("Reading index from SQLite");
  done(dbPath);

  step("Generating HTML pages");
  const result = generateSite({ dbPath, outDir, rootDir });
  done();

  header("Site Summary");
  summary([
    ["Symbol pages", result.symbolPages],
    ["File pages", result.filePages],
    ["Total files", result.totalFiles],
    ["Output", path.resolve(outDir)],
  ]);

  console.log(`\n  Open ${outDir}/index.html in your browser.\n`);
}

/* ================== build-docs command ================== */

function runBuildDocs(args: string[]) {
  const { flags } = parseArgs(args, {
    out: "docs-output",
    db: ".doc-kit/index.db",
    root: ".",
  });

  const dbPath = flags.db;
  const outDir = flags.out;
  const rootDir = flags.root;

  if (!fs.existsSync(dbPath)) {
    console.error(`Error: Database not found at ${dbPath}`);
    console.error(`Run "doc-kit index" first to create the index.`);
    process.exit(1);
  }

  header(`Generating docs: ${outDir}/`);

  step("Reading index from SQLite");
  done(dbPath);

  step("Generating Markdown pages");
  const result = generateDocs({ dbPath, outDir, rootDir });
  done();

  header("Docs Summary");
  summary([
    ["Symbol pages", result.symbolPages],
    ["File pages", result.filePages],
    ["Total files", result.totalFiles],
    ["Output", path.resolve(outDir)],
  ]);

  console.log(`\n  Open ${outDir}/README.md to browse the documentation.\n`);
}

/* ================== generate-repo-docs command ================== */

async function generateRepoDocumentation(
  repoDir: string = ".",
  docsDir: string = "docs",
  dbPath: string = ".doc-kit/registry.db",
  _excludeDirs: string[] = [],
) {
  header("Generating Repository Documentation");

  const config = await loadConfig(repoDir);

  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(dbPath);
  const registry = createDocRegistry(db);

  step("Rebuilding doc registry");
  await registry.rebuild(docsDir);
  done();

  const parser = new Parser();

  step("Scanning for source files");
  const relativeFiles = await fg(config.include, {
    cwd: path.resolve(repoDir),
    ignore: config.exclude,
    absolute: false,
  });
  const tsFiles = relativeFiles.map((f) => path.join(repoDir, f));
  done(`found ${tsFiles.length} files`);

  let totalSymbols = 0;
  let createdDocs = 0;
  let skippedDocs = 0;

  step("Processing symbols");
  console.log();

  for (const filePath of tsFiles) {
    try {
      const source = fs.readFileSync(filePath, "utf-8");
      const symbols = indexFile(filePath, source, parser);

      for (const symbol of symbols) {
        totalSymbols++;
        const mappings = await registry.findDocBySymbol(symbol.name);

        if (mappings.length === 0) {
          const docPath = `domain/${symbol.name}.md`;
          const fullDocPath = path.join(docsDir, docPath);
          const docDir = path.dirname(fullDocPath);

          if (!fs.existsSync(docDir)) {
            fs.mkdirSync(docDir, { recursive: true });
          }

          const description = generateSymbolDescription(symbol);
          const usage = generateUsageExample(symbol);

          const initialContent = `---
title: ${symbol.name}
symbols:
  - ${symbol.name}
lastUpdated: ${new Date().toISOString().slice(0, 10)}
---

# ${symbol.name}

> ${symbol.name} (${symbol.kind} in ${path.relative(process.cwd(), symbol.file)}).

## Description

${description}

## Usage

${usage}
`;

          fs.writeFileSync(fullDocPath, initialContent, "utf-8");

          await registry.register({
            symbolName: symbol.name,
            docPath,
          });

          createdDocs++;
          console.log(`     + ${symbol.name} -> ${docPath}`);
        } else {
          skippedDocs++;
        }
      }
    } catch (error) {
      console.error(`     ! Error: ${filePath}:`, error);
    }
  }

  db.close();

  header("Documentation Summary");
  summary([
    ["Files scanned", tsFiles.length],
    ["Symbols found", totalSymbols],
    ["Docs created", createdDocs],
    ["Already documented", skippedDocs],
    ["Output directory", docsDir],
  ]);
  console.log();
}

function generateSymbolDescription(symbol: CodeSymbol): string {
  switch (symbol.kind) {
    case "interface":
      return `Interface that defines the structure for ${symbol.name}. It includes properties and methods that implementing classes must provide.`;
    case "class":
      return `Class implementation for ${symbol.name}. ${symbol.signature || ""}`;
    case "function":
      return `Function that ${symbol.signature ? `has the signature: \`${symbol.signature}\`` : "performs a specific operation"}.`;
    case "method":
      return `Method ${symbol.signature ? `with signature: \`${symbol.signature}\`` : ""} that belongs to a class or interface.`;
    case "enum":
      return `Enumeration that defines a set of named constants for ${symbol.name}.`;
    case "type":
      return `Type alias that provides an alternative name for ${symbol.name}.`;
    default:
      return `Code symbol of type ${symbol.kind}.`;
  }
}

function generateUsageExample(symbol: CodeSymbol): string {
  switch (symbol.kind) {
    case "interface":
      return `Implement this interface in classes that need to conform to the ${symbol.name} contract:

\`\`\`typescript
class MyClass implements ${symbol.name} {
  // Implement required properties and methods
}
\`\`\``;
    case "class":
      return `Create instances of this class:

\`\`\`typescript
const instance = new ${symbol.name}();
// Use the instance methods and properties
\`\`\``;
    case "function":
      return `Call this function:

\`\`\`typescript
const result = ${symbol.name}();
// Use the result
\`\`\``;
    case "enum":
      return `Use enum values:

\`\`\`typescript
const value = ${symbol.name}.SomeValue;
// Use the enum value
\`\`\``;
    default:
      return `TODO: Add usage examples here.`;
  }
}

async function runProjectStatus(args: string[]) {
  const { flags } = parseArgs(args, {
    db: ".doc-kit/registry.db",
    docs: "docs",
  });

  const dbPath = flags.db;
  const docsDir = flags.docs;

  if (!fs.existsSync(dbPath)) {
    console.error(`Error: Database not found at ${dbPath}`);
    console.error(`Run "doc-kit index" first to create the index.`);
    process.exit(1);
  }

  header("Generating Project Status Report");

  step("Reading data from database");
  const db = new Database(dbPath);
  const registry = createDocRegistry(db);
  const symbolRepo = createSymbolRepository(db);
  const relRepo = createRelationshipRepository(db);
  const graph = createKnowledgeGraph(db);
  const patternAnalyzer = createPatternAnalyzer();
  const archGuard = createArchGuard();
  const reaper = createReaper();
  done();

  step("Generating status report");
  const result = await generateProjectStatus(
    { docsDir },
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
  done();

  db.close();

  console.log(formatProjectStatus(result));
}

async function runSmartCodeReview(args: string[]) {
  const { flags } = parseArgs(args, {
    db: ".doc-kit/index.db",
    docs: "docs",
  });

  const dbPath = flags.db;
  const docsDir = flags.docs;
  const includeExamples = !("no-examples" in flags);

  if (!fs.existsSync(dbPath)) {
    console.error(`Error: Database not found at ${dbPath}`);
    console.error(`Run "doc-kit index" first to create the index.`);
    process.exit(1);
  }

  header("Performing Smart Code Review");

  step("Reading data from database");
  const db = new Database(dbPath);
  const registry = createDocRegistry(db);
  const symbolRepo = createSymbolRepository(db);
  const relRepo = createRelationshipRepository(db);
  const graph = createKnowledgeGraph(db);
  const patternAnalyzer = createPatternAnalyzer();
  const archGuard = createArchGuard();
  const reaper = createReaper();
  done();

  step("Running comprehensive code review");
  const codeExampleValidator = includeExamples ? createCodeExampleValidator() : undefined;
  const result = await performSmartCodeReview(
    { docsDir, includeExamples },
    {
      symbolRepo,
      relRepo,
      registry,
      patternAnalyzer,
      archGuard,
      reaper,
      graph,
      codeExampleValidator,
    },
  );
  done();

  db.close();

  console.log(result);
}

async function runDeadCodeScan(args: string[]) {
  const { flags } = parseArgs(args, {
    db: ".doc-kit/index.db",
    docs: "docs",
  });

  const dbPath = flags.db;
  const docsDir = flags.docs;

  if (!fs.existsSync(dbPath)) {
    console.error(`Error: Database not found at ${dbPath}`);
    console.error(`Run "doc-kit index" first to create the index.`);
    process.exit(1);
  }

  header("Scanning for Dead Code");

  step("Reading data from database");
  const db = new Database(dbPath);
  const registry = createDocRegistry(db);
  const symbolRepo = createSymbolRepository(db);
  const graph = createKnowledgeGraph(db);
  const reaper = createReaper();
  done();

  step("Rebuilding registry");
  await registry.rebuild(docsDir);
  done();

  const allSymbols = symbolRepo.findAll();
  const mappings = await registry.findAllMappings();

  // Debug: Check relationships
  const relCount = db.prepare("SELECT COUNT(*) as count FROM relationships").get() as { count: number };
  console.log(`Found ${relCount.count} relationships in database`);

  step("Scanning for dead code");
  const findings = reaper.scan(allSymbols, graph, mappings);
  const deadCodeFindings = findings.filter(f => f.type === "dead_code");
  done(`${deadCodeFindings.length} dead code issues found`);

  if (deadCodeFindings.length > 0) {
    step("Marking dead code in database");
    reaper.markDeadCode(symbolRepo, deadCodeFindings);
    done();

    console.log("\nDead Code Findings:");
    for (const finding of deadCodeFindings) {
      console.log(`- ${finding.target}: ${finding.reason}`);
    }
  } else {
    console.log("\nNo dead code found.");
  }

  db.close();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
