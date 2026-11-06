import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface FileChangeVelocity {
  lastModifiedBy?: string;
  lastModifiedAt?: Date;
  changeCount30d: number;
  changeCount90d: number;
  isHotspot: boolean;
}

async function runGit(rootDir: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd: rootDir, timeout: 10_000 });
    return stdout.trim();
  } catch {
    return "";
  }
}

/**
 * Loads change velocity data for all files in the repo with a single git log pass.
 * Returns a map from relative file path to FileChangeVelocity.
 *
 * Uses git log --name-only to avoid one git call per file.
 */
export async function loadRepoChangeData(
  rootDir: string,
  hotspotThreshold = 5,
): Promise<Map<string, FileChangeVelocity>> {
  const output = await runGit(rootDir, [
    "log",
    "--since=90 days ago",
    "--pretty=format:COMMIT|%an|%aI",
    "--name-only",
    "--diff-filter=ACMR",
  ]);

  if (!output) return new Map();

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  type CommitEntry = { author: string; date: Date; isRecent: boolean };
  const fileCommits = new Map<string, CommitEntry[]>();

  let currentAuthor = "";
  let currentDate: Date | null = null;
  let currentIsRecent = false;

  for (const line of output.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("COMMIT|")) {
      const [, author = "", dateStr = ""] = trimmed.split("|");
      currentAuthor = author;
      const parsed = new Date(dateStr);
      currentDate = isNaN(parsed.getTime()) ? null : parsed;
      currentIsRecent = currentDate ? currentDate.getTime() >= thirtyDaysAgo : false;
    } else if (currentDate) {
      if (!fileCommits.has(trimmed)) fileCommits.set(trimmed, []);
      fileCommits.get(trimmed)!.push({
        author: currentAuthor,
        date: currentDate,
        isRecent: currentIsRecent,
      });
    }
  }

  const result = new Map<string, FileChangeVelocity>();
  for (const [filePath, commits] of fileCommits) {
    const lastCommit = commits[0];
    const changeCount30d = commits.filter((c) => c.isRecent).length;
    result.set(filePath, {
      lastModifiedBy: lastCommit?.author || undefined,
      lastModifiedAt: lastCommit?.date,
      changeCount30d,
      changeCount90d: commits.length,
      isHotspot: changeCount30d >= hotspotThreshold,
    });
  }

  return result;
}
