import * as fs from "fs";
import * as path from "path";
import Database from "better-sqlite3";
import { Result } from "../../../../@core/domain/Result.js";
import type {
  ISiteGenerator,
  SiteGenerationOptions,
  SiteGenerationResult,
} from "../../domain/services/index.js";
import type { SymbolRow, RelationshipRow, DocEntryRow, SearchIndexItem } from "./types.js";

/**
 * Site Generator Implementation
 *
 * Generates a static HTML documentation site from indexed symbols and relationships.
 * This implementation wraps the legacy generator with proper error handling and DDD structure.
 */
export class SiteGenerator implements ISiteGenerator {
  async generate(options: SiteGenerationOptions): Promise<Result<SiteGenerationResult>> {
    const { dbPath, outDir, rootDir = "." } = options;

    try {
      // Validate database exists
      if (!fs.existsSync(dbPath)) {
        return Result.fail(new Error(`Database not found at ${dbPath}. Run index command first.`));
      }

      // Validate database is readable
      let db: Database.Database;
      try {
        db = new Database(dbPath, { readonly: true });
      } catch (error) {
        return Result.fail(
          new Error(
            `Failed to open database: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      }

      try {
        // Call the legacy generator
        const result = await this.generateSiteInternal(db, outDir, rootDir);

        db.close();

        return Result.ok({
          ...result,
          outputPath: path.resolve(outDir),
        });
      } catch (error) {
        db.close();
        throw error;
      }
    } catch (error) {
      return Result.fail(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Internal site generation logic (simplified version)
   * In a full implementation, this would import and use the templates from the master branch
   */
  private async generateSiteInternal(
    db: Database.Database,
    outDir: string,
    _rootDir: string,
  ): Promise<Omit<SiteGenerationResult, "outputPath">> {
    // Create output directories
    fs.mkdirSync(path.join(outDir, "symbols"), { recursive: true });
    fs.mkdirSync(path.join(outDir, "files"), { recursive: true });
    fs.mkdirSync(path.join(outDir, "assets"), { recursive: true });

    // Query symbols from database
    const symbolRows = db.prepare("SELECT * FROM symbols").all() as SymbolRow[];
    const symbols = symbolRows;

    // Get unique files
    const files = [...new Set(symbols.map((s) => s.file))];

    // Query relationships
    const relationships = db.prepare("SELECT * FROM relationships").all() as RelationshipRow[];

    // Load doc entries (if registered_docs table exists)
    let docEntries: DocEntryRow[] = [];
    try {
      docEntries = db
        .prepare("SELECT path, title, name, category, module FROM registered_docs")
        .all() as DocEntryRow[];
    } catch {
      // Table may not exist
      docEntries = [];
    }

    // Generate basic index.html
    const indexHtml = this.generateIndexPage(symbols, files, relationships);
    fs.writeFileSync(path.join(outDir, "index.html"), indexHtml);

    // Generate symbol pages (simplified - just create placeholder files)
    for (const symbol of symbols) {
      const symbolHtml = this.generateSymbolPage(symbol);
      fs.writeFileSync(path.join(outDir, "symbols", `${symbol.id}.html`), symbolHtml);
    }

    // Generate file pages (simplified)
    for (const file of files) {
      const fileSymbols = symbols.filter((s) => s.file === file);
      const fileHtml = this.generateFilePage(file, fileSymbols);
      const fileSlug = file.replace(/[^a-zA-Z0-9]/g, "-");
      fs.writeFileSync(path.join(outDir, "files", `${fileSlug}.html`), fileHtml);
    }

    // Generate search index
    const searchIndex: SearchIndexItem[] = symbols.map((s) => ({
      id: s.id,
      name: s.name,
      kind: s.kind,
      file: s.file,
    }));
    fs.writeFileSync(path.join(outDir, "search.json"), JSON.stringify(searchIndex));

    return {
      symbolPages: symbols.length,
      filePages: files.length,
      totalFiles: symbols.length + files.length + 1,
      docEntries: docEntries.length,
    };
  }

  private generateIndexPage(
    symbols: SymbolRow[],
    files: string[],
    relationships: RelationshipRow[],
  ): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Documentation Site</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #333; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0; }
    .stat-card { background: #f5f5f5; padding: 20px; border-radius: 8px; }
    .stat-number { font-size: 2em; font-weight: bold; color: #0066cc; }
    .stat-label { color: #666; margin-top: 5px; }
  </style>
</head>
<body>
  <h1>📚 Documentation Site</h1>
  <div class="stats">
    <div class="stat-card">
      <div class="stat-number">${symbols.length}</div>
      <div class="stat-label">Symbols</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${files.length}</div>
      <div class="stat-label">Files</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${relationships.length}</div>
      <div class="stat-label">Relationships</div>
    </div>
  </div>
  <p>Generated at: ${new Date().toISOString()}</p>
</body>
</html>`;
  }

  private generateSymbolPage(symbol: SymbolRow): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${symbol.name} - Symbol</title>
</head>
<body>
  <h1>${symbol.name}</h1>
  <p>Kind: ${symbol.kind}</p>
  <p>File: ${symbol.file}</p>
  <p>Lines: ${symbol.start_line}-${symbol.end_line}</p>
</body>
</html>`;
  }

  private generateFilePage(file: string, symbols: SymbolRow[]): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${file} - File</title>
</head>
<body>
  <h1>${file}</h1>
  <h2>Symbols (${symbols.length})</h2>
  <ul>
    ${symbols.map((s) => `<li>${s.name} (${s.kind})</li>`).join("\n    ")}
  </ul>
</body>
</html>`;
  }
}
