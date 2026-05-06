import fs from "node:fs";
import path from "node:path";
import Parser from "tree-sitter";
import type { ResolvedConfig } from "../../../configLoader.js";
import { indexFile } from "../../../indexer/indexer.js";
import { indexInParallel } from "../../../indexer/parallelIndexer.js";
import type { CodeSymbol } from "../../../indexer/symbol.types.js";
import type { FileHashRepository, SymbolRepository } from "../../../storage/db.js";
import { done, step } from "../../utils/index.js";

export interface IndexSymbolsResult {
  allSymbols: CodeSymbol[];
  trees: Map<string, Parser.Tree>;
  sources: Map<string, string>;
  indexErrors: Array<{ file: string; error: string }>;
}

export async function indexSymbols(
  tsFiles: string[],
  configDir: string,
  symbolRepo: SymbolRepository,
  fileHashRepo: FileHashRepository,
  parser: Parser,
  fullRebuild: boolean,
  config: ResolvedConfig,
): Promise<IndexSymbolsResult> {
  step("Parsing AST and extracting symbols");

  const parallelEnabled = config.indexing?.parallel ?? true;
  const maxWorkers = config.indexing?.maxWorkers;

  if (parallelEnabled && tsFiles.length > 10) {
    return await indexSymbolsParallel(
      tsFiles,
      configDir,
      symbolRepo,
      fileHashRepo,
      fullRebuild,
      maxWorkers,
    );
  }

  return await indexSymbolsSequential(
    tsFiles,
    configDir,
    symbolRepo,
    fileHashRepo,
    parser,
    fullRebuild,
  );
}

async function indexSymbolsParallel(
  tsFiles: string[],
  configDir: string,
  symbolRepo: SymbolRepository,
  fileHashRepo: FileHashRepository,
  fullRebuild: boolean,
  maxWorkers?: number,
): Promise<IndexSymbolsResult> {
  const files = tsFiles.map((filePath) => ({
    filePath,
    relPath: path.relative(configDir, path.resolve(filePath)),
  }));

  const result = await indexInParallel({
    files,
    configDir,
    fileHashRepo,
    fullRebuild,
    maxWorkers,
  });

  const allSymbols: CodeSymbol[] = [];
  const trees = new Map<string, Parser.Tree>();
  const sources = new Map<string, string>();

  for (const file of files) {
    const { relPath } = file;
    const hash = result.hashes.get(relPath);
    const source = result.sources.get(relPath);
    const fileSymbols = result.symbols.filter((symbol) => symbol.file === relPath);

    if (hash) {
      fileHashRepo.upsert(relPath, hash);
    }

    if (fileSymbols.length > 0 || source) {
      allSymbols.push(...fileSymbols);
      if (source) {
        sources.set(relPath, source);
        const parser = new Parser();
        const symbols = indexFile(relPath, source, parser);
        if (symbols.length > 0) {
          const tree = parser.parse(source);
          if (tree?.rootNode) {
            trees.set(relPath, tree);
          }
        }
      }
    } else {
      const existingSymbols = symbolRepo.findByFile(relPath);
      allSymbols.push(...existingSymbols);
      try {
        const fullPath = path.resolve(configDir, relPath);
        const fileSource = fs.readFileSync(fullPath, "utf-8");
        sources.set(relPath, fileSource);
        const parser = new Parser();
        const symbols = indexFile(relPath, fileSource, parser);
        if (symbols.length > 0) {
          const tree = parser.parse(fileSource);
          if (tree?.rootNode) {
            trees.set(relPath, tree);
          }
        }
      } catch {
        // If we cannot load source, skip relationship extraction for this file.
      }
    }
  }

  const skipMsg = result.skippedCount > 0 ? ` (${result.skippedCount} unchanged, skipped)` : "";
  const errorMsg = result.errors.length > 0 ? ` (${result.errors.length} errors)` : "";
  done(`${allSymbols.length} symbols${errorMsg}${skipMsg}`);

  return {
    allSymbols,
    trees,
    sources,
    indexErrors: result.errors,
  };
}

async function indexSymbolsSequential(
  tsFiles: string[],
  configDir: string,
  symbolRepo: SymbolRepository,
  fileHashRepo: FileHashRepository,
  parser: Parser,
  fullRebuild: boolean,
): Promise<IndexSymbolsResult> {
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
      const hash = createHash("sha256").update(source).digest("hex");

      if (!fullRebuild) {
        const existing = fileHashRepo.get(relPath);
        if (existing && existing.contentHash === hash) {
          skippedCount++;
          const existingSymbols = symbolRepo.findByFile(relPath);
          allSymbols.push(...existingSymbols);
          continue;
        }
      }

      fileHashRepo.upsert(relPath, hash);
      symbolRepo.deleteByFile(relPath);

      const symbols = indexFile(relPath, source, parser);
      const tree = parser.parse(source);
      trees.set(relPath, tree);
      sources.set(relPath, source);
      const stat = fs.statSync(filePath);
      for (const symbol of symbols) {
        symbol.lastModified = stat.mtime;
        symbol.source = "human";
      }
      allSymbols.push(...symbols);
    } catch (err) {
      errorCount++;
      const message = err instanceof Error ? err.message : String(err);
      const relPath = path.relative(configDir, path.resolve(filePath));
      indexErrors.push({ file: relPath, error: message });
    }
  }

  const skipMsg = skippedCount > 0 ? ` (${skippedCount} unchanged, skipped)` : "";
  done(`${allSymbols.length} symbols${errorCount > 0 ? ` (${errorCount} errors)` : ""}${skipMsg}`);

  return { allSymbols, trees, sources, indexErrors };
}

export function reportIndexErrors(indexErrors: Array<{ file: string; error: string }>) {
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
    for (const file of files.slice(0, 5)) {
      console.error(`         ${file}`);
    }
    if (files.length > 5) {
      console.error(`         ... and ${files.length - 5} more`);
    }
  }
  console.error();
}
