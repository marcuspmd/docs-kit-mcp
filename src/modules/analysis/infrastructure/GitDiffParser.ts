import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface FileDiff {
  filePath: string;
  status: "added" | "modified" | "deleted" | "renamed";
  oldPath?: string;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  content: string;
}

/**
 * GitDiffParser
 *
 * Parses git diff output to extract file changes and hunks.
 */
export class GitDiffParser {
  /**
   * Get diff between two refs (branches, commits, tags)
   */
  async getDiff(baseBranch: string, targetBranch?: string, cwd = "."): Promise<FileDiff[]> {
    const ref = targetBranch ? `${baseBranch}..${targetBranch}` : baseBranch;

    try {
      // Get diff with unified format
      const { stdout } = await execAsync(`git diff --unified=3 ${ref}`, {
        cwd,
        maxBuffer: 10 * 1024 * 1024,
      });
      return this.parseDiff(stdout);
    } catch (error) {
      console.error("Failed to get git diff:", error);
      return [];
    }
  }

  /**
   * Get diff for uncommitted changes
   */
  async getWorkingDiff(cwd = "."): Promise<FileDiff[]> {
    try {
      const { stdout } = await execAsync("git diff HEAD", { cwd, maxBuffer: 10 * 1024 * 1024 });
      return this.parseDiff(stdout);
    } catch (error) {
      console.error("Failed to get working diff:", error);
      return [];
    }
  }

  /**
   * Parse git diff output
   */
  private parseDiff(diffOutput: string): FileDiff[] {
    const files: FileDiff[] = [];
    const lines = diffOutput.split("\n");

    let currentFile: Partial<FileDiff> | null = null;
    let currentHunk: Partial<DiffHunk> | null = null;
    let hunkLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // New file diff
      if (line.startsWith("diff --git")) {
        // Save previous file
        if (currentFile && currentHunk) {
          currentHunk.content = hunkLines.join("\n");
          currentFile.hunks?.push(currentHunk as DiffHunk);
          files.push(currentFile as FileDiff);
        }

        currentFile = {
          filePath: "",
          status: "modified",
          additions: 0,
          deletions: 0,
          hunks: [],
        };
        currentHunk = null;
        hunkLines = [];
        continue;
      }

      if (!currentFile) continue;

      // File paths
      if (line.startsWith("--- a/")) {
        const path = line.substring(6);
        if (path !== "/dev/null") {
          currentFile.oldPath = path;
          currentFile.filePath = path;
        }
      } else if (line.startsWith("+++ b/")) {
        const path = line.substring(6);
        if (path !== "/dev/null") {
          currentFile.filePath = path;
        }

        // Determine status
        if (currentFile.oldPath === "/dev/null" || !currentFile.oldPath) {
          currentFile.status = "added";
        } else if (path === "/dev/null") {
          currentFile.status = "deleted";
          currentFile.filePath = currentFile.oldPath;
        } else if (currentFile.oldPath !== path) {
          currentFile.status = "renamed";
        }
      }
      // Hunk header: @@ -1,5 +1,6 @@
      else if (line.startsWith("@@")) {
        // Save previous hunk
        if (currentHunk) {
          currentHunk.content = hunkLines.join("\n");
          currentFile.hunks?.push(currentHunk as DiffHunk);
        }

        const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (match) {
          currentHunk = {
            oldStart: parseInt(match[1], 10),
            oldLines: parseInt(match[2] || "1", 10),
            newStart: parseInt(match[3], 10),
            newLines: parseInt(match[4] || "1", 10),
            content: "",
          };
          hunkLines = [];
        }
      }
      // Hunk content
      else if (currentHunk) {
        hunkLines.push(line);
        if (line.startsWith("+") && !line.startsWith("+++")) {
          currentFile.additions = (currentFile.additions || 0) + 1;
        } else if (line.startsWith("-") && !line.startsWith("---")) {
          currentFile.deletions = (currentFile.deletions || 0) + 1;
        }
      }
    }

    // Save last file
    if (currentFile && currentHunk) {
      currentHunk.content = hunkLines.join("\n");
      currentFile.hunks?.push(currentHunk as DiffHunk);
      files.push(currentFile as FileDiff);
    }

    return files;
  }

  /**
   * Get list of changed files (without full diff)
   */
  async getChangedFiles(baseBranch: string, targetBranch?: string, cwd = "."): Promise<string[]> {
    const ref = targetBranch ? `${baseBranch}..${targetBranch}` : baseBranch;

    try {
      const { stdout } = await execAsync(`git diff --name-only ${ref}`, { cwd });
      return stdout
        .trim()
        .split("\n")
        .filter((f) => f.length > 0);
    } catch (error) {
      console.error("Failed to get changed files:", error);
      return [];
    }
  }
}
