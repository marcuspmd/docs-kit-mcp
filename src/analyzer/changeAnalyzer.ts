import { execFile } from "node:child_process";
import { promisify } from "node:util";
import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import type { ChangeImpact, CodeSymbol } from "../indexer/symbol.types.js";
import { indexFile } from "../indexer/indexer.js";
import {
  buildStructuredDiff,
  getGitDiff,
  getGitMergeBase,
  type FileDiff,
  type DiffHunk,
  type GitDiffRange,
} from "./gitDiff.js";
import { diffSymbols, type AstChange } from "./astDiff.js";

const execFileAsync = promisify(execFile);

export interface AnalyzeOptions {
  repoPath: string;
  base: string;
  head?: string;
  range?: GitDiffRange;
}

export interface AnalyzeDeps {
  getFileDiffs: (options: AnalyzeOptions) => Promise<FileDiff[]>;
  getFileAtRef: (repoPath: string, filePath: string, ref: string) => Promise<string | null>;
  indexSource: (filePath: string, source: string) => CodeSymbol[];
  getMergeBase?: (options: AnalyzeOptions) => Promise<string>;
}

export function isSymbolImpacted(symbol: CodeSymbol, hunks: DiffHunk[]): boolean {
  return isSymbolImpactedOnSide(symbol, hunks, "new");
}

function hunkEnd(start: number, lines: number): number {
  return start + Math.max(lines, 1) - 1;
}

function isSymbolImpactedOnSide(
  symbol: CodeSymbol,
  hunks: DiffHunk[],
  side: "old" | "new",
): boolean {
  return hunks.some((hunk) => {
    const start = side === "old" ? hunk.oldStart : hunk.newStart;
    const lines = side === "old" ? hunk.oldLines : hunk.newLines;
    return start <= symbol.endLine && hunkEnd(start, lines) >= symbol.startLine;
  });
}

export function requiresDocUpdate(change: AstChange): boolean {
  return (
    change.changeType === "added" ||
    change.changeType === "removed" ||
    change.changeType === "signature_changed"
  );
}

export function extractRelevantDiff(fileDiff: FileDiff, symbol: CodeSymbol): string {
  return extractRelevantHunks(fileDiff, symbol, "new")
    .map((h) => h.content)
    .join("\n");
}

function extractRelevantHunks(
  fileDiff: FileDiff,
  symbol: CodeSymbol,
  side: "old" | "new",
): DiffHunk[] {
  return fileDiff.hunks.filter((hunk) => {
    const start = side === "old" ? hunk.oldStart : hunk.newStart;
    const lines = side === "old" ? hunk.oldLines : hunk.newLines;
    return start <= symbol.endLine && hunkEnd(start, lines) >= symbol.startLine;
  });
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

export function createDefaultDeps(): AnalyzeDeps {
  return {
    getFileDiffs: getGitDiff,
    getFileAtRef: defaultGetFileAtRef,
    indexSource: defaultIndexSource(),
    getMergeBase: getGitMergeBase,
  };
}

async function resolveBaseRef(options: AnalyzeOptions, deps: AnalyzeDeps): Promise<string> {
  if ((options.range ?? "direct") !== "merge-base") return options.base;
  return deps.getMergeBase ? deps.getMergeBase(options) : options.base;
}

export async function analyzeChanges(
  options: AnalyzeOptions,
  deps?: AnalyzeDeps,
): Promise<ChangeImpact[]> {
  const actualDeps = deps ?? createDefaultDeps();
  const { getFileDiffs, getFileAtRef, indexSource } = actualDeps;
  const diffs = await getFileDiffs(options);
  const impacts: ChangeImpact[] = [];
  const head = options.head ?? "HEAD";
  const baseRef = await resolveBaseRef(options, actualDeps);

  for (const fileDiff of diffs) {
    const oldSource =
      fileDiff.status !== "added"
        ? await getFileAtRef(options.repoPath, fileDiff.oldPath, baseRef)
        : null;
    const newSource =
      fileDiff.status !== "deleted"
        ? await getFileAtRef(options.repoPath, fileDiff.newPath, head)
        : null;

    const oldSymbols = oldSource ? indexSource(fileDiff.oldPath, oldSource) : [];
    const newSymbols = newSource ? indexSource(fileDiff.newPath, newSource) : [];
    const astChanges = diffSymbols(oldSymbols, newSymbols);

    for (const change of astChanges) {
      const diffSide = change.changeType === "removed" ? "old" : "new";
      if (
        change.changeType !== "added" &&
        change.changeType !== "removed" &&
        !isSymbolImpactedOnSide(change.symbol, fileDiff.hunks, diffSide)
      ) {
        continue;
      }

      const relevantHunks = extractRelevantHunks(fileDiff, change.symbol, diffSide);

      impacts.push({
        symbol: change.symbol,
        changeType: change.changeType as ChangeImpact["changeType"],
        diff: relevantHunks.map((hunk) => hunk.content).join("\n"),
        structuredDiff: buildStructuredDiff(relevantHunks),
        docUpdateRequired: requiresDocUpdate(change),
      });
    }
  }

  return impacts;
}
