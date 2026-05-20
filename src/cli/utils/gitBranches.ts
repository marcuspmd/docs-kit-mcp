import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);

export interface BranchEntry {
  name: string;
  isRemote: boolean;
  committerDate: Date;
  subject: string;
  isCurrent: boolean;
}

export async function getCurrentBranch(repoPath: string): Promise<string> {
  try {
    const { stdout } = await execFile("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: repoPath,
    });
    return stdout.trim();
  } catch {
    return "HEAD";
  }
}

export async function listBranches(repoPath: string, max = 20): Promise<BranchEntry[]> {
  const current = await getCurrentBranch(repoPath);

  let stdout = "";
  try {
    const result = await execFile(
      "git",
      [
        "for-each-ref",
        "--sort=-committerdate",
        "refs/heads",
        "refs/remotes/origin",
        "--format=%(refname:short)|%(committerdate:iso)|%(subject)",
      ],
      { cwd: repoPath },
    );
    stdout = result.stdout;
  } catch {
    return [];
  }

  const entries: BranchEntry[] = [];
  for (const line of stdout.trim().split("\n")) {
    if (!line.trim()) continue;
    const [name, dateStr, ...subjectParts] = line.split("|");
    const trimmedName = name?.trim();
    if (!trimmedName || trimmedName === "origin/HEAD") continue;

    const isRemote = trimmedName.startsWith("origin/");
    const subject = subjectParts.join("|").trim().slice(0, 72);
    const committerDate = new Date(dateStr?.trim() ?? "");

    entries.push({
      name: trimmedName,
      isRemote,
      committerDate,
      subject,
      isCurrent: trimmedName === current,
    });
  }

  // Local branches first, then remote
  const local = entries.filter((e) => !e.isRemote);
  const remote = entries.filter((e) => e.isRemote);

  return [...local, ...remote].slice(0, max);
}

export function formatBranchAge(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d atrás`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks} sem atrás`;
  return `${Math.floor(weeks / 4)} meses atrás`;
}
