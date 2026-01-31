import * as fs from "fs";
import * as path from "path";
import Database from "better-sqlite3";
import type { CodeSymbol } from "../indexer/symbol.types.js";
import type { RelationshipRow } from "../storage/db.js";
import type { DetectedPattern } from "../patterns/patternAnalyzer.js";
import {
  renderDashboard,
  renderSymbolPage,
  renderFilePage,
  renderRelationshipsPage,
  renderPatternsPage,
  buildSearchIndex,
  fileSlug,
} from "./templates.js";

export interface GeneratorOptions {
  dbPath: string;
  outDir: string;
  rootDir?: string;
}

interface SymbolRow {
  id: string;
  name: string;
  qualified_name: string | null;
  kind: string;
  file: string;
  start_line: number;
  end_line: number;
  parent: string | null;
  visibility: string | null;
  exported: number | null;
  signature: string | null;
  pattern: string | null;
  metrics: string | null;
  doc_ref: string | null;
  summary: string | null;
  tags: string | null;
  last_modified: string | null;
}

function rowToSymbol(row: SymbolRow): CodeSymbol {
  return {
    id: row.id,
    name: row.name,
    qualifiedName: row.qualified_name ?? undefined,
    kind: row.kind as CodeSymbol["kind"],
    file: row.file,
    startLine: row.start_line,
    endLine: row.end_line,
    parent: row.parent ?? undefined,
    visibility: (row.visibility as CodeSymbol["visibility"]) ?? undefined,
    exported: row.exported !== null ? row.exported === 1 : undefined,
    signature: row.signature ?? undefined,
    pattern: row.pattern ?? undefined,
    metrics: row.metrics ? JSON.parse(row.metrics) : undefined,
    docRef: row.doc_ref ?? undefined,
    summary: row.summary ?? undefined,
    tags: row.tags ? JSON.parse(row.tags) : undefined,
    lastModified: row.last_modified ? new Date(row.last_modified) : undefined,
  };
}

function readSource(rootDir: string | undefined, filePath: string): string | undefined {
  if (!rootDir) return undefined;
  try {
    return fs.readFileSync(path.join(rootDir, filePath), "utf-8");
  } catch {
    return undefined;
  }
}

export interface GenerateResult {
  symbolPages: number;
  filePages: number;
  totalFiles: number;
}

export function generateSite(options: GeneratorOptions): GenerateResult {
  const { dbPath, outDir, rootDir } = options;

  const db = new Database(dbPath, { readonly: true });

  const symbolRows = db.prepare("SELECT * FROM symbols").all() as SymbolRow[];
  const symbols = symbolRows.map(rowToSymbol);

  const relationships = db.prepare("SELECT * FROM relationships").all() as RelationshipRow[];

  db.close();

  const patterns: DetectedPattern[] = [];
  const files = [...new Set(symbols.map((s) => s.file))];

  // Create output directories
  fs.mkdirSync(path.join(outDir, "symbols"), { recursive: true });
  fs.mkdirSync(path.join(outDir, "files"), { recursive: true });

  // Cache source files
  const sourceCache = new Map<string, string | undefined>();
  function getSource(file: string): string | undefined {
    if (!sourceCache.has(file)) {
      sourceCache.set(file, readSource(rootDir, file));
    }
    return sourceCache.get(file);
  }

  // Generate index.html
  fs.writeFileSync(
    path.join(outDir, "index.html"),
    renderDashboard({ symbols, relationships, patterns, files }),
  );

  // Generate symbol pages
  for (const symbol of symbols) {
    const source = getSource(symbol.file);
    fs.writeFileSync(
      path.join(outDir, "symbols", `${symbol.id}.html`),
      renderSymbolPage(symbol, symbols, relationships, source),
    );
  }

  // Generate file pages
  for (const file of files) {
    const fileSymbols = symbols.filter((s) => s.file === file);
    // Generate search index (items + facets)
    const searchIndex = buildSearchIndex(symbols);
    fs.writeFileSync(path.join(outDir, "search.json"), JSON.stringify(searchIndex));
  }

  // Generate relationships page
  fs.writeFileSync(
    path.join(outDir, "relationships.html"),
    renderRelationshipsPage(relationships, symbols),
  );

  // Generate patterns page
  fs.writeFileSync(path.join(outDir, "patterns.html"), renderPatternsPage(patterns, symbols));

  // Generate search index
  fs.writeFileSync(path.join(outDir, "search.json"), JSON.stringify(buildSearchIndex(symbols)));

  return {
    symbolPages: symbols.length,
    filePages: files.length,
    totalFiles: symbols.length + files.length + 4, // index + relationships + patterns + search.json
  };
}
