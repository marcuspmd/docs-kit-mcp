import { execFile } from "node:child_process";
import { promisify } from "node:util";
import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import type { ChangeImpact, CodeSymbol } from "../indexer/symbol.types.js";
import { indexFile } from "../indexer/indexer.js";
import { getGitDiff, type FileDiff, type DiffHunk } from "./gitDiff.js";
import { diffSymbols, type AstChange } from "./astDiff.js";

const execFileAsync = promisify(execFile);

export interface AnalyzeOptions {
  repoPath: string;
  base: string;
  head?: string;
}

export interface AnalyzeDeps {
  getFileDiffs: (options: AnalyzeOptions) => Promise<FileDiff[]>;
  getFileAtRef: (repoPath: string, filePath: string, ref: string) => Promise<string | null>;
  indexSource: (filePath: string, source: string) => CodeSymbol[];
}

export function isSymbolImpacted(symbol: CodeSymbol, hunks: DiffHunk[]): boolean {
  return hunks.some(
    (h) => h.newStart <= symbol.endLine && h.newStart + h.newLines >= symbol.startLine,
  );
}

export function requiresDocUpdate(change: AstChange): boolean {
  return (
    change.changeType === "added" ||
    change.changeType === "removed" ||
    change.changeType === "signature_changed"
  );
}

export function extractRelevantDiff(fileDiff: FileDiff, symbol: CodeSymbol): string {
  return fileDiff.hunks
    .filter((h) => h.newStart <= symbol.endLine && h.newStart + h.newLines >= symbol.startLine)
    .map((h) => h.content)
    .join("\n");
}

async function defaultGetFileAtRef(
  repoPath: string,
  filePath: string,
  ref: string,
): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["show", `${ref}:${filePath}`], {
      cwd: repoPath,
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout;
  } catch {
    return null;
  }
}

function defaultIndexSource(): (filePath: string, source: string) => CodeSymbol[] {
  const parser = new Parser();
  parser.setLanguage(TypeScript.typescript);
  return (filePath, source) => indexFile(filePath, source, parser);
}

function createDefaultDeps(): AnalyzeDeps {
  return {
    getFileDiffs: getGitDiff,
    getFileAtRef: defaultGetFileAtRef,
    indexSource: defaultIndexSource(),
  };
}

export async function analyzeChanges(
  options: AnalyzeOptions,
  deps?: AnalyzeDeps,
): Promise<ChangeImpact[]> {
  const { getFileDiffs, getFileAtRef, indexSource } = deps ?? createDefaultDeps();
  const diffs = await getFileDiffs(options);
  const impacts: ChangeImpact[] = [];
  const head = options.head ?? "HEAD";

  for (const fileDiff of diffs) {
    const oldSource =
      fileDiff.status !== "added"
        ? await getFileAtRef(options.repoPath, fileDiff.oldPath, options.base)
        : null;
    const newSource =
      fileDiff.status !== "deleted"
        ? await getFileAtRef(options.repoPath, fileDiff.newPath, head)
        : null;

    const oldSymbols = oldSource ? indexSource(fileDiff.oldPath, oldSource) : [];
    const newSymbols = newSource ? indexSource(fileDiff.newPath, newSource) : [];
    const astChanges = diffSymbols(oldSymbols, newSymbols);

    for (const change of astChanges) {
      if (
        change.changeType !== "added" &&
        change.changeType !== "removed" &&
        !isSymbolImpacted(change.symbol, fileDiff.hunks)
      ) {
        continue;
      }

      impacts.push({
        symbol: change.symbol,
        changeType: change.changeType as ChangeImpact["changeType"],
        diff: extractRelevantDiff(fileDiff, change.symbol),
        docUpdateRequired: requiresDocUpdate(change),
      });
    }
  }

  return impacts;
}
