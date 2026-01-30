# Task 03 — Git Diff Parser

> **Status:** pending
> **Layer:** Analysis
> **Priority:** MVP
> **Depends on:** 01
> **Unblocks:** 05

## Pain Point
Raw `git diff` output is unstructured text. To determine which symbols were affected by a commit or PR, the system needs a structured representation of changed files and line ranges. Without this, the Change Analyzer (Task 05) can't correlate diffs to symbols.

## Objective
Parse unified diff output from Git into structured `FileDiff` and `DiffHunk` objects, identifying changed line ranges per file.

## Technical Hints

```ts
// src/analyzer/gitDiff.ts

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

/** Parse raw unified diff string into structured diffs */
export function parseGitDiff(rawDiff: string): FileDiff[];

/** Run git diff between two refs and return parsed result */
export async function getGitDiff(options: {
  repoPath: string;
  base: string;       // e.g., "main", "HEAD~1", commit SHA
  head?: string;      // default: working tree
}): Promise<FileDiff[]>;
```

Parse the `@@` hunk headers:

```ts
// Regex for unified diff hunk header: @@ -oldStart,oldLines +newStart,newLines @@
const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
```

Use `execFile` (not shell-based execution) for Git commands to avoid injection:

```ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execFileAsync = promisify(execFile);

async function runGitDiff(repoPath: string, base: string, head?: string): Promise<string> {
  const args = ["diff", "--unified=3", base];
  if (head) args.push(head);
  const { stdout } = await execFileAsync("git", args, { cwd: repoPath });
  return stdout;
}
```

## Files Involved
- `src/analyzer/gitDiff.ts` — diff parser and git integration
- `tests/analyzer.test.ts` — unit tests

## Acceptance Criteria
- [ ] `parseGitDiff` correctly parses added, deleted, modified, and renamed files
- [ ] Hunk line ranges are accurate for multi-hunk diffs
- [ ] `getGitDiff` uses `execFile` (safe from shell injection) and returns parsed results
- [ ] Handles binary files gracefully (skips them)
- [ ] Handles empty diffs (returns `[]`)
- [ ] Unit tests with fixture diff strings (no real git repo needed for parser tests)

## Scenarios / Examples

```ts
const raw = `diff --git a/src/user.ts b/src/user.ts
index abc..def 100644
--- a/src/user.ts
+++ b/src/user.ts
@@ -10,4 +10,6 @@ class User {
   getName() {
     return this.name;
   }
+  getEmail() {
+    return this.email;
+  }
 }`;

const diffs = parseGitDiff(raw);
// diffs[0].status === "modified"
// diffs[0].hunks[0].newStart === 10
// diffs[0].hunks[0].newLines === 6
```
