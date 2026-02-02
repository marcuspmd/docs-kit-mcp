import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import type { CodeSymbol } from "../indexer/symbol.types.js";
import type { RelationshipRow } from "../storage/db.js";
import type { DetectedPattern, PatternKind } from "../patterns/patternAnalyzer.js";
import {
  renderDashboard,
  renderSymbolPage,
  renderFilePage,
  renderFilesPage,
  renderRelationshipsPage,
  renderPatternsPage,
  renderDeprecatedPage,
  renderDocsPage,
  renderGovernancePage,
  renderMarkdownWrapper,
  buildSearchIndex,
  fileSlug,
} from "./templates.js";

// ES module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface GeneratorOptions {
  dbPath?: string;
  db?: Database.Database;
  outDir: string;
  rootDir?: string;
}

/** Doc entry for docs index and nav. From docs-config.json or symbol doc_ref. */
export interface DocEntry {
  path: string;
  title?: string;
  name?: string;
  category?: string;
  /** Tag: several docs can share the same module for grouping. */
  module?: string;
  /** Path of the next doc (for sequential navigation). */
  next?: string;
  /** Path of the previous doc (for sequential navigation). */
  prev?: string;
  /** If set, copy from rootDir/sourcePath to outDir/path (for docs from another location). */
  sourcePath?: string;
}

interface DocsConfig {
  docs: DocEntry[];
}

/** Path inside the site (no leading ../ or ./). Used for output and URLs. */
function normalizeSitePath(p: string): string {
  return (
    p
      .replace(/^\.\.\/+/, "")
      .replace(/^\.\/+/, "")
      .replace(/\\/g, "/")
      .trim() || p
  );
}

interface LoadDocsConfigResult {
  entries: DocEntry[];
  /** Directory where docs-config.json was found (for resolving sourcePath with ../). */
  configDir: string | null;
}

/** Load docs from docs-config.json (legacy) */
function loadDocsConfigJson(_rootDir?: string): LoadDocsConfigResult {
  // Always load from project root (cwd). The index path (e.g. "src") is only for
  // indexing source files, not for config lookup.
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
    const entries = docs.map((e) => ({
      ...e,
      path: normalizeSitePath(e.path),
      // Keep sourcePath as-is so we can resolve relative to configDir when it starts with ../
      sourcePath: e.sourcePath,
      prev: e.prev ? normalizeSitePath(e.prev) : undefined,
      next: e.next ? normalizeSitePath(e.next) : undefined,
    }));
    return { entries, configDir };
  } catch {
    return { entries: [], configDir: null };
  }
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

/** Load docs from registered_docs table in database */
function loadDocsFromDb(db: Database.Database): DocEntry[] {
  try {
    const rows = db
      .prepare(
        "SELECT path, title, name, category, module, previous, next, show_on_menu FROM registered_docs ORDER BY category, title",
      )
      .all() as RegisteredDocRow[];
    return rows.map((r) => ({
      path: normalizeSitePath(r.path),
      title: r.title,
      name: r.name,
      category: r.category,
      module: r.module,
      prev: r.previous ? normalizeSitePath(r.previous) : undefined,
      next: r.next ? normalizeSitePath(r.next) : undefined,
      showOnMenu: r.show_on_menu === 1,
    }));
  } catch {
    // Table may not exist in older databases
    return [];
  }
}

/** Merge docs from database and config file (db takes precedence) */
function loadDocsConfig(db: Database.Database, _rootDir?: string): LoadDocsConfigResult {
  const dbDocs = loadDocsFromDb(db);
  const { entries: jsonDocs, configDir } = loadDocsConfigJson(_rootDir);

  // Merge: DB docs take precedence, then JSON docs
  const entriesMap = new Map<string, DocEntry>();
  for (const entry of jsonDocs) {
    entriesMap.set(entry.path, entry);
  }
  for (const entry of dbDocs) {
    entriesMap.set(entry.path, entry);
  }

  return { entries: Array.from(entriesMap.values()), configDir };
}

interface PatternRow {
  kind: string;
  symbols: string;
  confidence: number;
  violations: string | null;
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
  layer: string | null;
  deprecated: number | null;
  violations: string | null;
  explanation: string | null;
}

function parseJsonArray(value: string | null): string[] | undefined {
  return value ? JSON.parse(value) : undefined;
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
    layer: (row.layer as CodeSymbol["layer"]) ?? undefined,
    deprecated: row.deprecated !== null ? row.deprecated === 1 : undefined,
    violations: parseJsonArray(row.violations),
    explanation: row.explanation ?? undefined,
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
  const { outDir, rootDir } = options;

  const ownsDb = !options.db;
  const db = options.db ?? new Database(options.dbPath!, { readonly: true });

  const symbolRows = db.prepare("SELECT * FROM symbols").all() as SymbolRow[];
  const symbols = symbolRows.map(rowToSymbol);

  const relationships = db.prepare("SELECT * FROM relationships").all() as RelationshipRow[];

  // Load patterns if table exists
  let patterns: DetectedPattern[] = [];
  try {
    const patternRows = db.prepare("SELECT * FROM patterns").all() as PatternRow[];
    patterns = patternRows.map((row) => ({
      kind: row.kind as PatternKind,
      symbols: JSON.parse(row.symbols) as string[],
      confidence: row.confidence,
      violations: row.violations ? (JSON.parse(row.violations) as string[]) : [],
    }));
  } catch (e) {
    patterns = [];
  }

  // Load arch_violations and reaper_findings if tables exist
  interface ArchViolationRow {
    rule: string;
    file: string;
    symbol_id: string | null;
    message: string;
    severity: string;
  }
  interface ReaperFindingRow {
    type: string;
    target: string;
    reason: string;
    suggested_action: string;
  }
  let archViolations: ArchViolationRow[] = [];
  let reaperFindings: ReaperFindingRow[] = [];
  try {
    archViolations = db
      .prepare("SELECT rule, file, symbol_id, message, severity FROM arch_violations")
      .all() as ArchViolationRow[];
  } catch {
    archViolations = [];
  }
  try {
    reaperFindings = db
      .prepare("SELECT type, target, reason, suggested_action FROM reaper_findings")
      .all() as ReaperFindingRow[];
  } catch {
    reaperFindings = [];
  }

  // NOTE: Do NOT close db here - we need it for loadDocsConfig later

  const files = [...new Set(symbols.map((s) => s.file))];
  const docRefs = new Set<string>();

  // Create output directories
  fs.mkdirSync(path.join(outDir, "symbols"), { recursive: true });
  fs.mkdirSync(path.join(outDir, "files"), { recursive: true });

  // Helper function to copy directories recursively
  const copyRecursive = (src: string, dest: string) => {
    if (!fs.existsSync(src)) return;

    if (fs.statSync(src).isDirectory()) {
      fs.mkdirSync(dest, { recursive: true });
      for (const entry of fs.readdirSync(src)) {
        copyRecursive(path.join(src, entry), path.join(dest, entry));
      }
    } else {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
  };

  // Copy assets directory if it exists from target project
  const assetsSource = path.join(rootDir || ".", "assets");
  const assetsTarget = path.join(outDir, "assets");
  if (fs.existsSync(assetsSource)) {
    copyRecursive(assetsSource, assetsTarget);
  }

  // Always copy docs-kit assets (logo, etc.) for branding
  // This ensures the logo appears even when generating sites for other projects
  const docsKitAssetsSource = path.join(__dirname, "..", "..", "assets");
  if (fs.existsSync(docsKitAssetsSource)) {
    copyRecursive(docsKitAssetsSource, assetsTarget);
  }

  // Cache source files
  const sourceCache = new Map<string, string | undefined>();
  function getSource(file: string): string | undefined {
    if (!sourceCache.has(file)) {
      // Try a few candidate locations to be resilient to stored file paths
      let content: string | undefined = undefined;

      // direct from configured root
      content = readSource(rootDir, file);

      // try with src/ prefix or without it
      if (!content && rootDir) {
        content = readSource(rootDir, path.join("src", file));
        if (!content) content = readSource(rootDir, file.replace(/^src[\\/]/, ""));
      }

      // try absolute paths relative to cwd
      if (!content) {
        try {
          const p = path.join(process.cwd(), file);
          if (fs.existsSync(p) && fs.statSync(p).isFile()) content = fs.readFileSync(p, "utf-8");
        } catch {
          /* ignore */
        }
      }

      if (!content) {
        try {
          const p2 = path.join(process.cwd(), "src", file);
          if (fs.existsSync(p2) && fs.statSync(p2).isFile()) content = fs.readFileSync(p2, "utf-8");
        } catch {
          /* ignore */
        }
      }

      sourceCache.set(file, content);
    }
    return sourceCache.get(file);
  }

  // Build doc entries: from database and config, then symbol doc_ref (dedupe by path)
  for (const s of symbols) {
    if (s.docRef) docRefs.add(s.docRef);
  }
  const { entries: configDocs, configDir: docsConfigDir } = loadDocsConfig(db, rootDir);

  // Close the database only if we opened it ourselves
  if (ownsDb) db.close();

  const docEntriesMap = new Map<string, DocEntry>();
  for (const entry of configDocs) {
    docEntriesMap.set(entry.path, entry);
  }
  for (const ref of docRefs) {
    const normalized = normalizeSitePath(ref);
    if (!docEntriesMap.has(normalized)) {
      docEntriesMap.set(normalized, { path: normalized });
    }
  }
  const docEntries = Array.from(docEntriesMap.values());
  console.log(
    `DEBUG: Total docEntries = ${docEntries.length}`,
    docEntries.map((d) => `${d.path} (cat: ${d.category || "NONE"})`),
  );

  // Generate index.html with docEntries for menu
  fs.writeFileSync(
    path.join(outDir, "index.html"),
    renderDashboard({
      symbols,
      relationships,
      patterns,
      files,
      archViolations,
      reaperFindings,
      generatedAt: new Date().toISOString(),
      docEntries,
    }),
  );

  const cwd = process.cwd();
  const resolvedRoot = rootDir ? path.resolve(rootDir) : null;

  for (const entry of docEntries) {
    const docRef = entry.path;
    const sourceRef = entry.sourcePath ?? docRef;
    const sourceRefNormalized = normalizeSitePath(sourceRef);
    const candidates = [] as string[];
    if (docsConfigDir) {
      if (sourceRef.startsWith("../") || sourceRef.startsWith("..\\")) {
        candidates.push(path.resolve(docsConfigDir, sourceRef));
      } else if (!path.isAbsolute(sourceRef)) {
        candidates.push(path.join(docsConfigDir, sourceRef));
      }
    }
    candidates.push(path.join(cwd, sourceRefNormalized));
    candidates.push(path.join(cwd, "docs", sourceRefNormalized));
    if (resolvedRoot) {
      candidates.push(path.join(resolvedRoot, sourceRefNormalized));
      candidates.push(path.join(resolvedRoot, "docs", sourceRefNormalized));
    }
    candidates.push(path.join(cwd, "docs-output", sourceRefNormalized));

    let content: string | undefined = undefined;
    for (const c of candidates) {
      try {
        if (fs.existsSync(c) && fs.statSync(c).isFile()) {
          content = fs.readFileSync(c, "utf-8");
          break;
        }
      } catch {
        // ignore
      }
    }

    if (content !== undefined) {
      const outPath = path.join(outDir, docRef);
      const outDirPath = path.dirname(outPath);
      fs.mkdirSync(outDirPath, { recursive: true });
      fs.writeFileSync(outPath, content, "utf-8");
      try {
        const mdName = path.basename(docRef);
        const outHtmlPath = outPath.replace(/\.md$/i, ".html");
        const wrapper = renderMarkdownWrapper(mdName, mdName, docRef, docEntries, content);

        fs.writeFileSync(outHtmlPath, wrapper, "utf-8");
      } catch (e) {
        console.error(`Error generating HTML for ${docRef}:`, e);
        throw e;
      }
    } else {
      const linked = symbols.filter((s) => s.docRef === docRef);
      if (linked.length > 0) {
        const title = path.basename(docRef, path.extname(docRef));
        const lines = [] as string[];
        lines.push("---");
        lines.push(`title: ${title}`);
        lines.push("symbols:");
        for (const s of linked) lines.push(`  - ${s.name}`);
        lines.push(`lastUpdated: ${new Date().toISOString().slice(0, 10)}`);
        lines.push("---\n");
        lines.push(`# ${title}\n`);
        lines.push(
          `This page was generated automatically by docs-kit as a placeholder for ${linked.length} symbol(s).`,
        );
        lines.push("");
        for (const s of linked) {
          lines.push(`- [${s.name}](../symbols/${s.id}.html) - ${s.signature ?? ""}`);
        }

        const generatedContent = lines.join("\n");
        const outPath = path.join(outDir, docRef);
        const outDirPath = path.dirname(outPath);
        fs.mkdirSync(outDirPath, { recursive: true });
        fs.writeFileSync(outPath, generatedContent, "utf-8");
        try {
          const mdName = path.basename(docRef);
          const outHtmlPath = outPath.replace(/\.md$/i, ".html");
          const wrapper = renderMarkdownWrapper(
            mdName,
            mdName,
            docRef,
            docEntries,
            generatedContent,
          );

          fs.writeFileSync(outHtmlPath, wrapper, "utf-8");
        } catch (e) {
          console.error(`Error generating placeholder HTML for ${docRef}:`, e);
          throw e;
        }
      }
    }
  }

  // Generate symbol pages
  for (const symbol of symbols) {
    const source = getSource(symbol.file);
    const symbolViolations = archViolations.filter((v) => v.symbol_id === symbol.id);
    fs.writeFileSync(
      path.join(outDir, "symbols", `${symbol.id}.html`),
      renderSymbolPage(symbol, symbols, relationships, source, symbolViolations, docEntries),
    );
  }

  // Generate file pages
  for (const file of files) {
    const fileSymbols = symbols.filter((s) => s.file === file);
    const source = getSource(file);
    const fileViolations = archViolations.filter((v) => v.file === file);
    fs.writeFileSync(
      path.join(outDir, "files", `${fileSlug(file)}.html`),
      renderFilePage(file, fileSymbols, source, relationships, symbols, fileViolations, docEntries),
    );
  }

  // Generate files directory page
  fs.writeFileSync(path.join(outDir, "files.html"), renderFilesPage(files, symbols, docEntries));

  // Generate relationships page
  fs.writeFileSync(
    path.join(outDir, "relationships.html"),
    renderRelationshipsPage(relationships, symbols, docEntries),
  );

  // Generate patterns page
  fs.writeFileSync(
    path.join(outDir, "patterns.html"),
    renderPatternsPage(patterns, symbols, docEntries),
  );

  // Generate governance page
  fs.writeFileSync(
    path.join(outDir, "governance.html"),
    renderGovernancePage(archViolations, reaperFindings, symbols, docEntries),
  );

  // Generate deprecated page
  fs.writeFileSync(path.join(outDir, "deprecated.html"), renderDeprecatedPage(symbols, docEntries));

  // Generate docs index page
  fs.writeFileSync(path.join(outDir, "docs.html"), renderDocsPage(docEntries));

  // Generate search index
  // Historically tests expect search.json to be an array of items.
  // Write the items array for compatibility, but keep generator using buildSearchIndex.
  const indexObj = buildSearchIndex(symbols);
  fs.writeFileSync(path.join(outDir, "search.json"), JSON.stringify(indexObj.items));

  return {
    symbolPages: symbols.length,
    filePages: files.length,
    totalFiles: symbols.length + files.length + 7 + docEntries.length,
  };
}
