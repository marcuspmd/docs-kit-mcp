import { execFile } from "node:child_process";
import { promisify } from "node:util";

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

const DIFF_HEADER = /^diff --git a\/(.+) b\/(.+)$/;
const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
const BINARY_MARKER = /^Binary files/;

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

    // Skip index line, mode lines, etc.
    let status: FileDiff["status"] = "modified";
    let isBinary = false;

    while (i < lines.length && !lines[i].startsWith("---") && !lines[i].startsWith("diff --git") && !BINARY_MARKER.test(lines[i])) {
      if (lines[i].startsWith("new file")) status = "added";
      else if (lines[i].startsWith("deleted file")) status = "deleted";
      else if (lines[i].startsWith("similarity index") || lines[i].startsWith("rename from")) status = "renamed";
      i++;
    }

    if (i < lines.length && BINARY_MARKER.test(lines[i])) {
      isBinary = true;
      i++;
    }

    if (isBinary) continue;

    // Skip --- and +++ lines
    if (i < lines.length && lines[i].startsWith("---")) i++;
    if (i < lines.length && lines[i].startsWith("+++")) i++;

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

      hunks.push({
        oldStart,
        oldLines,
        newStart,
        newLines,
        content: contentLines.join("\n"),
      });
    }

    files.push({ oldPath, newPath, status, hunks });
  }

  return files;
}

export async function getGitDiff(options: {
  repoPath: string;
  base: string;
  head?: string;
}): Promise<FileDiff[]> {
  const args = ["diff", "--unified=3", options.base];
  if (options.head) args.push(options.head);

  const { stdout } = await execFileAsync("git", args, {
    cwd: options.repoPath,
    maxBuffer: 10 * 1024 * 1024,
  });

  return parseGitDiff(stdout);
}
