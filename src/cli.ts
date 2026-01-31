#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import Database from "better-sqlite3";
import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import { createDocRegistry } from "./docs/docRegistry.js";
import { indexFile } from "./indexer/indexer.js";
import { extractRelationships } from "./indexer/relationshipExtractor.js";
import { collectMetrics } from "./indexer/metricsCollector.js";
import { createPatternAnalyzer } from "./patterns/patternAnalyzer.js";
import {
  initializeSchema,
  createSymbolRepository,
  createRelationshipRepository,
} from "./storage/db.js";
import { generateSite } from "./site/generator.js";
import { generateDocs } from "./site/mdGenerator.js";
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
        (args[4] || "node_modules,dist,.git,docs,tests,.doc-kit")
          .split(",")
          .map((d) => d.trim()),
      );
      break;
    default:
      printHelp();
      process.exit(command === "--help" || command === "-h" ? 0 : 1);
  }
}

function printHelp() {
  console.log(`doc-kit - Intelligent documentation agent

Usage:
  doc-kit index [dir] [--exclude dirs] [--db path] [--docs dir]
                                                        Index repository
  doc-kit build-site [--out dir] [--db path] [--root dir]
                                                        Generate static HTML site
  doc-kit build-docs [--out dir] [--db path] [--root dir]
                                                        Generate Markdown documentation
  doc-kit generate-repo-docs [repo-dir] [docs-dir]     Generate markdown docs
  doc-kit --help                                        Show this help

Commands:
  index              Scan .ts files, extract symbols, relationships, metrics
  build-site         Generate navigable HTML documentation from index
  build-docs         Generate structured Markdown documentation from index
  generate-repo-docs Create markdown doc stubs for undocumented symbols
`);
}

function parseArgs(
  args: string[],
  flags: Record<string, string>,
): { positional: string[]; flags: Record<string, string> } {
  const positional: string[] = [];
  const result = { ...flags };
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--") && i + 1 < args.length) {
      const key = args[i].slice(2);
      result[key] = args[++i];
    } else {
      positional.push(args[i]);
    }
  }
  return { positional, flags: result };
}

/* ================== index command ================== */

async function runIndex(args: string[]) {
  const { positional, flags } = parseArgs(args, {
    exclude: "node_modules,dist,.git,docs,tests,.doc-kit",
    db: ".doc-kit/index.db",
    docs: "docs",
  });

  const rootDir = positional[0] || ".";
  const dbPath = flags.db;
  const docsDir = flags.docs;
  const excludeDirs = flags.exclude.split(",").map((d) => d.trim());

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

  const parser = new Parser();
  parser.setLanguage(TypeScript.typescript);

  // Find all .ts files
  step("Scanning for .ts files");
  const tsFiles: string[] = [];
  function findTsFiles(dir: string) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        if (!excludeDirs.includes(item)) {
          findTsFiles(fullPath);
        }
      } else if (item.endsWith(".ts") && !item.endsWith(".d.ts")) {
        tsFiles.push(fullPath);
      }
    }
  }
  findTsFiles(rootDir);
  done(`found ${tsFiles.length} files`);

  // Phase 1: Index symbols + collect AST trees
  step("Parsing AST and extracting symbols");
  let allSymbols: CodeSymbol[] = [];
  const trees = new Map<string, Parser.Tree>();
  const sources = new Map<string, string>();
  let errorCount = 0;

  for (const filePath of tsFiles) {
    try {
      const source = fs.readFileSync(filePath, "utf-8");
      const relPath = path.relative(rootDir, filePath);
      const symbols = indexFile(relPath, source, parser);
      const tree = parser.parse(source);
      trees.set(relPath, tree);
      sources.set(relPath, source);
      allSymbols.push(...symbols);
    } catch {
      errorCount++;
    }
  }
  done(`${allSymbols.length} symbols${errorCount > 0 ? ` (${errorCount} errors)` : ""}`);

  // Phase 2: Extract relationships
  step("Extracting relationships");
  const relationships = extractRelationships({
    symbols: allSymbols,
    trees,
    sources,
  });
  done(`${relationships.length} relationships`);

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
  excludeDirs: string[] = ["node_modules", "dist", ".git", "docs", "tests", ".doc-kit"],
) {
  header("Generating Repository Documentation");

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
  parser.setLanguage(TypeScript.typescript);

  step("Scanning for .ts files");
  const tsFiles: string[] = [];
  function findTsFiles(dir: string) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        if (!excludeDirs.includes(item)) {
          findTsFiles(fullPath);
        }
      } else if (item.endsWith(".ts") && !item.endsWith(".d.ts")) {
        tsFiles.push(fullPath);
      }
    }
  }
  findTsFiles(repoDir);
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

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
