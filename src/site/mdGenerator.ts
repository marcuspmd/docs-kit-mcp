import * as fs from "fs";
import * as path from "path";
import Database from "better-sqlite3";
import type { CodeSymbol } from "../indexer/symbol.types.js";
import type { RelationshipRow } from "../storage/db.js";
import type { DetectedPattern } from "../patterns/patternAnalyzer.js";
import { fileSlug } from "./shared.js";
import {
  renderDashboardMd,
  renderSymbolMd,
  renderFileMd,
  renderRelationshipsMd,
  renderPatternsMd,
} from "./mdTemplates.js";

export interface MdGeneratorOptions {
  dbPath?: string;
  db?: Database.Database;
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

export interface MdGenerateResult {
  symbolPages: number;
  filePages: number;
  totalFiles: number;
}

export function generateDocs(options: MdGeneratorOptions): MdGenerateResult {
  const { outDir, rootDir } = options;

  const ownsDb = !options.db;
  const db = options.db ?? new Database(options.dbPath!, { readonly: true });

  const symbolRows = db.prepare("SELECT * FROM symbols").all() as SymbolRow[];
  const symbols = symbolRows.map(rowToSymbol);

  const relationships = db
    .prepare("SELECT * FROM relationships")
    .all() as RelationshipRow[];

  if (ownsDb) db.close();

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

  // Generate README.md
  fs.writeFileSync(
    path.join(outDir, "README.md"),
    renderDashboardMd({ symbols, relationships, patterns, files }),
  );

  // Generate symbol pages
  for (const symbol of symbols) {
    const source = getSource(symbol.file);
    fs.writeFileSync(
      path.join(outDir, "symbols", `${symbol.id}.md`),
      renderSymbolMd(symbol, symbols, relationships, source),
    );
  }

  // Generate file pages
  for (const file of files) {
    const fileSymbols = symbols.filter((s) => s.file === file);
    const source = getSource(file);
    fs.writeFileSync(
      path.join(outDir, "files", `${fileSlug(file)}.md`),
      renderFileMd(file, fileSymbols, source),
    );
  }

  // Generate relationships page
  fs.writeFileSync(
    path.join(outDir, "relationships.md"),
    renderRelationshipsMd(relationships, symbols),
  );

  // Generate patterns page
  fs.writeFileSync(
    path.join(outDir, "patterns.md"),
    renderPatternsMd(patterns, symbols),
  );

  return {
    symbolPages: symbols.length,
    filePages: files.length,
    totalFiles: symbols.length + files.length + 3, // README + relationships + patterns
  };
}
