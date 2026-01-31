import * as fs from "fs";
import * as path from "path";
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
  renderMarkdownWrapper,
  buildSearchIndex,
  fileSlug,
} from "./templates.js";


export interface GeneratorOptions {
  dbPath: string;
  outDir: string;
  rootDir?: string;
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
    // Patterns table doesn't exist, use empty array
    patterns = [];
  }

  db.close();
  const files = [...new Set(symbols.map((s) => s.file))];
  const docRefs = new Set<string>();

  // Create output directories
  fs.mkdirSync(path.join(outDir, "symbols"), { recursive: true });
  fs.mkdirSync(path.join(outDir, "files"), { recursive: true });

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

  // Generate index.html
  fs.writeFileSync(
    path.join(outDir, "index.html"),
    renderDashboard({ symbols, relationships, patterns, files }),
  );

  // Copy markdown docs referenced by symbols into the site output so links work
  for (const s of symbols) {
    if (s.docRef) docRefs.add(s.docRef);
  }

  for (const docRef of Array.from(docRefs)) {
    // Try multiple source locations: root/docs/<docRef>, root/<docRef>, docs-output/<docRef>
    const candidates = [] as string[];
    if (rootDir) {
      candidates.push(path.join(rootDir, "docs", docRef));
      candidates.push(path.join(rootDir, docRef));
    }
    candidates.push(path.join(process.cwd(), "docs-output", docRef));

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
      // Also create an HTML wrapper that will render the markdown in-browser
      try {
        const mdName = path.basename(docRef);
        const outHtmlPath = outPath.replace(/\.md$/i, ".html");
        const wrapper = renderMarkdownWrapper(mdName, mdName);

        fs.writeFileSync(outHtmlPath, wrapper, "utf-8");
      } catch (e) {
        // ignore wrapper errors
      }
    } else {
      // Create a placeholder markdown if the referenced doc doesn't exist
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

        const outPath = path.join(outDir, docRef);
        const outDirPath = path.dirname(outPath);
        fs.mkdirSync(outDirPath, { recursive: true });
        fs.writeFileSync(outPath, lines.join("\n"), "utf-8");
        // Also create an HTML wrapper for the placeholder so links to .html work
        try {
          const mdName = path.basename(docRef);
          const outHtmlPath = outPath.replace(/\.md$/i, ".html");
          const wrapper = renderMarkdownWrapper(mdName, mdName);

          fs.writeFileSync(outHtmlPath, wrapper, "utf-8");
        } catch (e) {
          // ignore wrapper errors
        }
      }
    }
  }

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
    const source = getSource(file);
    fs.writeFileSync(
      path.join(outDir, "files", `${fileSlug(file)}.html`),
      renderFilePage(file, fileSymbols, source),
    );
  }

  // Generate files directory page
  fs.writeFileSync(path.join(outDir, "files.html"), renderFilesPage(files, symbols));

  // Generate relationships page
  fs.writeFileSync(
    path.join(outDir, "relationships.html"),
    renderRelationshipsPage(relationships, symbols),
  );

  // Generate patterns page
  fs.writeFileSync(path.join(outDir, "patterns.html"), renderPatternsPage(patterns, symbols));

  // Generate search index
  // Historically tests expect search.json to be an array of items.
  // Write the items array for compatibility, but keep generator using buildSearchIndex.
  const indexObj = buildSearchIndex(symbols);
  fs.writeFileSync(path.join(outDir, "search.json"), JSON.stringify(indexObj.items));

  return {
    symbolPages: symbols.length,
    filePages: files.length,
    totalFiles: symbols.length + files.length + 4 + docRefs.size, // index + relationships + patterns + search.json + docs
  };
}
