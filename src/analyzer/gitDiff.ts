import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { StructuredDiff, StructuredDiffLine } from "../indexer/symbol.types.js";

const execFileAsync = promisify(execFile);

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  content: string;
}

export interface FileDiff {
  oldPath: string;
  newPath: string;
  status: "added" | "deleted" | "modified" | "renamed";
  hunks: DiffHunk[];
}

type ParsedHunkLine =
  | { kind: "context"; text: string }
  | { kind: "added"; text: string }
  | { kind: "removed"; text: string };

export type GitDiffRange = "direct" | "merge-base";

export interface GitDiffOptions {
  repoPath: string;
  base: string;
  head?: string;
  range?: GitDiffRange;
}

const DIFF_HEADER = /^diff --git a\/(.+) b\/(.+)$/;
const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
const BINARY_MARKER = /^Binary files/;

function parseHunkLine(line: string): ParsedHunkLine | null {
  if (line.startsWith("\\ No newline at end of file")) return null;
  if (line.startsWith("+") && !line.startsWith("+++")) {
    return { kind: "added", text: line.slice(1) };
  }
  if (line.startsWith("-") && !line.startsWith("---")) {
    return { kind: "removed", text: line.slice(1) };
  }
  if (line.startsWith(" ")) return { kind: "context", text: line.slice(1) };
  return { kind: "context", text: line };
}

function lineNumber(value: number): number | undefined {
  return value > 0 ? value : undefined;
}

function pushChangedLines(
  lines: StructuredDiffLine[],
  removed: string[],
  added: string[],
  oldStart: number,
  newStart: number,
): void {
  const length = Math.max(removed.length, added.length);

  for (let index = 0; index < length; index++) {
    const oldText = removed[index];
    const newText = added[index];

    if (oldText !== undefined && newText !== undefined) {
      lines.push({
        oldLineNumber: lineNumber(oldStart + index),
        newLineNumber: lineNumber(newStart + index),
        oldText,
        newText,
        tone: "changed",
      });
    } else if (oldText !== undefined) {
      lines.push({
        oldLineNumber: lineNumber(oldStart + index),
        oldText,
        tone: "removed",
      });
    } else if (newText !== undefined) {
      lines.push({
        newLineNumber: lineNumber(newStart + index),
        newText,
        tone: "added",
      });
    }
  }
}

export function buildStructuredDiff(hunks: DiffHunk[]): StructuredDiff {
  let addedLines = 0;
  let removedLines = 0;

  const structuredHunks = hunks.map((hunk) => {
    const lines: StructuredDiffLine[] = [];
    const parsedLines = hunk.content
      .split("\n")
      .map(parseHunkLine)
      .filter((line): line is ParsedHunkLine => Boolean(line));

    let index = 0;
    let oldLine = hunk.oldStart;
    let newLine = hunk.newStart;

    while (index < parsedLines.length) {
      const parsed = parsedLines[index];

      if (parsed.kind === "context") {
        lines.push({
          oldLineNumber: lineNumber(oldLine),
          newLineNumber: lineNumber(newLine),
          oldText: parsed.text,
          newText: parsed.text,
          tone: "context",
        });
        oldLine++;
        newLine++;
        index++;
        continue;
      }

      if (parsed.kind === "removed") {
        const removed: string[] = [];
        const added: string[] = [];
        const removedStart = oldLine;

        while (index < parsedLines.length && parsedLines[index].kind === "removed") {
          removed.push(parsedLines[index].text);
          index++;
        }

        const addedStart = newLine;
        while (index < parsedLines.length && parsedLines[index].kind === "added") {
          added.push(parsedLines[index].text);
          index++;
        }

        pushChangedLines(lines, removed, added, removedStart, addedStart);
        oldLine += removed.length;
        newLine += added.length;
        removedLines += removed.length;
        addedLines += added.length;
        continue;
      }

      const added: string[] = [];
      const addedStart = newLine;
      while (index < parsedLines.length && parsedLines[index].kind === "added") {
        added.push(parsedLines[index].text);
        index++;
      }

      pushChangedLines(lines, [], added, oldLine, addedStart);
      newLine += added.length;
      addedLines += added.length;
    }

    return {
      oldStart: hunk.oldStart,
      oldLines: hunk.oldLines,
      newStart: hunk.newStart,
      newLines: hunk.newLines,
      lines,
    };
  });

  return { hunks: structuredHunks, addedLines, removedLines };
}

function parseFileStatus(
  lines: string[],
  startIdx: number,
): { status: FileDiff["status"]; isBinary: boolean; nextIdx: number } {
  let i = startIdx;
  let status: FileDiff["status"] = "modified";
  let isBinary = false;

  while (
    i < lines.length &&
    !lines[i].startsWith("---") &&
    !lines[i].startsWith("diff --git") &&
    !BINARY_MARKER.test(lines[i])
  ) {
    if (lines[i].startsWith("new file")) status = "added";
    else if (lines[i].startsWith("deleted file")) status = "deleted";
    else if (lines[i].startsWith("similarity index") || lines[i].startsWith("rename from"))
      status = "renamed";
    i++;
  }

  if (i < lines.length && BINARY_MARKER.test(lines[i])) {
    isBinary = true;
    i++;
  }

  return { status, isBinary, nextIdx: i };
}

function parseHunks(lines: string[], startIdx: number): { hunks: DiffHunk[]; nextIdx: number } {
  let i = startIdx;
  const hunks: DiffHunk[] = [];

  while (i < lines.length && !lines[i].startsWith("diff --git")) {
    const hunkMatch = lines[i].match(HUNK_HEADER);
    if (!hunkMatch) {
      i++;
      continue;
    }

    const oldStart = parseInt(hunkMatch[1], 10);
    const oldLines = hunkMatch[2] !== undefined ? parseInt(hunkMatch[2], 10) : 1;
    const newStart = parseInt(hunkMatch[3], 10);
    const newLines = hunkMatch[4] !== undefined ? parseInt(hunkMatch[4], 10) : 1;
    i++;

    const contentLines: string[] = [];
    while (i < lines.length && !lines[i].startsWith("diff --git") && !HUNK_HEADER.test(lines[i])) {
      contentLines.push(lines[i]);
      i++;
    }

    hunks.push({ oldStart, oldLines, newStart, newLines, content: contentLines.join("\n") });
  }

  return { hunks, nextIdx: i };
}

export function parseGitDiff(rawDiff: string): FileDiff[] {
  if (!rawDiff.trim()) return [];

  const files: FileDiff[] = [];
  const lines = rawDiff.split("\n");
  let i = 0;

  while (i < lines.length) {
    const headerMatch = lines[i].match(DIFF_HEADER);
    if (!headerMatch) {
      i++;
      continue;
    }

    const oldPath = headerMatch[1];
    const newPath = headerMatch[2];
    i++;

    const { status, isBinary, nextIdx } = parseFileStatus(lines, i);
    i = nextIdx;

    if (isBinary) continue;

    // Skip --- and +++ lines
    if (i < lines.length && lines[i].startsWith("---")) i++;
    if (i < lines.length && lines[i].startsWith("+++")) i++;

    const { hunks, nextIdx: afterHunks } = parseHunks(lines, i);
    i = afterHunks;

    files.push({ oldPath, newPath, status, hunks });
  }

  return files;
}

function buildDiffRange(options: GitDiffOptions): string[] {
  const range = options.range ?? "direct";
  if (range === "merge-base") {
    const head = options.head ?? "HEAD";
    return [`${options.base}...${head}`];
  }

  return options.head ? [options.base, options.head] : [options.base];
}

export function buildGitDiffArgs(
  options: GitDiffOptions,
  mode: "patch" | "name-only" = "patch",
): string[] {
  return ["diff", mode === "patch" ? "--unified=3" : "--name-only", ...buildDiffRange(options)];
}

export async function getGitDiff(options: GitDiffOptions): Promise<FileDiff[]> {
  const args = buildGitDiffArgs(options);

  const { stdout } = await execFileAsync("git", args, {
    cwd: options.repoPath,
    maxBuffer: 10 * 1024 * 1024,
  });

  return parseGitDiff(stdout);
}

export async function getGitChangedFiles(options: GitDiffOptions): Promise<string[]> {
  const args = buildGitDiffArgs(options, "name-only");
  const { stdout } = await execFileAsync("git", args, {
    cwd: options.repoPath,
    maxBuffer: 10 * 1024 * 1024,
  });

  return stdout.trim().split("\n").filter(Boolean);
}

export async function getGitMergeBase(options: GitDiffOptions): Promise<string> {
  const head = options.head ?? "HEAD";
  const { stdout } = await execFileAsync("git", ["merge-base", options.base, head], {
    cwd: options.repoPath,
    maxBuffer: 1024 * 1024,
  });

  return stdout.trim();
}
