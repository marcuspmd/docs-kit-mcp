import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import type { CodeSymbol } from "../indexer/symbol.types.js";
import type { DetectedPattern, PatternKind } from "../patterns/patternAnalyzer.js";
import {
  rowToSymbol,
  type ArchViolationRow,
  type ReaperFindingRow,
  type RelationshipRow,
  type SymbolRow,
} from "../storage/db.js";
import type { DocEntry, SiteData } from "./templates/types.js";

interface DocsConfig {
  docs: DocEntry[];
}

interface LoadDocsConfigResult {
  entries: DocEntry[];
  configDir: string | null;
}

interface RegisteredDocRow {
  path: string;
  title: string;
  name: string;
  category: string;
  module: string;
  previous: string | null;
  next: string | null;
  show_on_menu: number;
}

interface PatternRow {
  kind: string;
  symbols: string;
  confidence: number;
  violations: string | null;
}

export interface LoadedSiteData extends SiteData {
  symbols: CodeSymbol[];
  relationships: RelationshipRow[];
  patterns: DetectedPattern[];
  files: string[];
  archViolations: ArchViolationRow[];
  reaperFindings: ReaperFindingRow[];
  docEntries: DocEntry[];
  docsConfigDir: string | null;
}

/** Path inside the site (no leading ../ or ./). Used for output and URLs. */
export function normalizeSitePath(p: string): string {
  return (
    p
      .replace(/^\.\.\/+/, "")
      .replace(/^\.\/+/, "")
      .replace(/\\/g, "/")
      .trim() || p
  );
}

function loadDocsConfigJson(_rootDir?: string): LoadDocsConfigResult {
  const configPath = path.join(process.cwd(), "docs-config.json");
  let raw: string | null = null;
  let configDir: string | null = null;
  try {
    if (fs.existsSync(configPath)) {
      raw = fs.readFileSync(configPath, "utf-8");
      configDir = path.dirname(path.resolve(configPath));
    }
  } catch {
    // ignore
  }
  if (!raw) return { entries: [], configDir: null };
  try {
    const parsed = JSON.parse(raw) as DocsConfig;
    const docs = Array.isArray(parsed.docs) ? parsed.docs : [];
    const entries = docs.map((entry) => ({
      ...entry,
      path: normalizeSitePath(entry.path),
      sourcePath: entry.sourcePath,
      prev: entry.prev ? normalizeSitePath(entry.prev) : undefined,
      next: entry.next ? normalizeSitePath(entry.next) : undefined,
    }));
    return { entries, configDir };
  } catch {
    return { entries: [], configDir: null };
  }
}

function loadDocsFromDb(db: Database.Database): DocEntry[] {
  try {
    const rows = db
      .prepare(
        "SELECT path, title, name, category, module, previous, next, show_on_menu FROM registered_docs ORDER BY category, title",
      )
      .all() as RegisteredDocRow[];
    return rows.map((row) => ({
      path: normalizeSitePath(row.path),
      title: row.title,
      name: row.name,
      category: row.category,
      module: row.module,
      prev: row.previous ? normalizeSitePath(row.previous) : undefined,
      next: row.next ? normalizeSitePath(row.next) : undefined,
      showOnMenu: row.show_on_menu === 1,
    }));
  } catch {
    return [];
  }
}

function loadDocsConfig(db: Database.Database, rootDir?: string): LoadDocsConfigResult {
  const dbDocs = loadDocsFromDb(db);
  const { entries: jsonDocs, configDir } = loadDocsConfigJson(rootDir);

  const entriesMap = new Map<string, DocEntry>();
  for (const entry of jsonDocs) {
    entriesMap.set(entry.path, entry);
  }
  for (const entry of dbDocs) {
    entriesMap.set(entry.path, entry);
  }

  return { entries: Array.from(entriesMap.values()), configDir };
}

function loadPatterns(db: Database.Database): DetectedPattern[] {
  try {
    const rows = db.prepare("SELECT * FROM patterns").all() as PatternRow[];
    return rows.map((row) => ({
      kind: row.kind as PatternKind,
      symbols: JSON.parse(row.symbols) as string[],
      confidence: row.confidence,
      violations: row.violations ? (JSON.parse(row.violations) as string[]) : [],
    }));
  } catch {
    return [];
  }
}

function loadArchViolations(db: Database.Database): ArchViolationRow[] {
  try {
    return db
      .prepare("SELECT rule, file, symbol_id, message, severity FROM arch_violations")
      .all() as ArchViolationRow[];
  } catch {
    return [];
  }
}

function loadReaperFindings(db: Database.Database): ReaperFindingRow[] {
  try {
    return db
      .prepare("SELECT type, target, reason, suggested_action FROM reaper_findings")
      .all() as ReaperFindingRow[];
  } catch {
    return [];
  }
}

export function loadSiteData(db: Database.Database, rootDir?: string): LoadedSiteData {
  const symbolRows = db.prepare("SELECT * FROM symbols").all() as SymbolRow[];
  const symbols = symbolRows.map(rowToSymbol);
  const relationships = db.prepare("SELECT * FROM relationships").all() as RelationshipRow[];
  const patterns = loadPatterns(db);
  const archViolations = loadArchViolations(db);
  const reaperFindings = loadReaperFindings(db);
  const files = [...new Set(symbols.map((symbol) => symbol.file))];
  const { entries: configDocs, configDir: docsConfigDir } = loadDocsConfig(db, rootDir);

  const docEntriesMap = new Map<string, DocEntry>();
  for (const entry of configDocs) {
    docEntriesMap.set(entry.path, entry);
  }
  for (const symbol of symbols) {
    if (!symbol.docRef) continue;
    const normalized = normalizeSitePath(symbol.docRef);
    if (!docEntriesMap.has(normalized)) {
      docEntriesMap.set(normalized, { path: normalized });
    }
  }

  return {
    symbols,
    relationships,
    patterns,
    files,
    archViolations,
    reaperFindings,
    docEntries: Array.from(docEntriesMap.values()),
    docsConfigDir,
  };
}
