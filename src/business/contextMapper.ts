import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fastGlob from "fast-glob";
import { join } from "node:path";
import type { DocRegistry } from "../docs/docRegistry.js";

const execFileAsync = promisify(execFile);

const TICKET_PATTERN = /[A-Z][A-Z0-9]+-\d+/g;
const COMMENT_REF_PATTERN = /\/\/\s*ref:\s*([A-Z][A-Z0-9]+-\d+)/g;

export interface BusinessRef {
  ticketId: string;
  source: "commit" | "comment" | "tag";
  symbolId?: string;
  file: string;
  line?: number;
}

export interface TraceabilityEntry {
  ticketId: string;
  symbols: string[];
  tests: string[];
  docs: string[];
}

export interface ContextMapper {
  extractRefs(repoPath: string): Promise<BusinessRef[]>;
  extractRefsFromLines(lines: Array<{ file: string; line: number; text: string }>): BusinessRef[];
  extractRefsFromCommits(messages: Array<{ message: string; files: string[] }>): BusinessRef[];
  buildRTM(refs: BusinessRef[], registry: DocRegistry): Promise<TraceabilityEntry[]>;
}

export function createContextMapper(): ContextMapper {
  return {
    async extractRefs(repoPath) {
      const refs: BusinessRef[] = [];

      // Extract from git log using execFile (safe against shell injection)
      try {
        const { stdout } = await execFileAsync(
          "git",
          ["log", "--pretty=format:%s|||%H", "--name-only", "-100"],
          { cwd: repoPath },
        );
        const commits = parseGitLog(stdout);
        refs.push(...this.extractRefsFromCommits(commits));
      } catch {
        // not a git repo or git unavailable
      }

      // Extract from code comments
      const sourceFiles = await fastGlob("**/*.{ts,js,py,go,php}", {
        cwd: repoPath,
        ignore: ["node_modules/**", "dist/**"],
      });

      for (const file of sourceFiles) {
        const content = await readFile(join(repoPath, file), "utf-8");
        const lines = content.split("\n");
        const lineData = lines.map((text, i) => ({ file, line: i + 1, text }));
        refs.push(...this.extractRefsFromLines(lineData));
      }

      return refs;
    },

    extractRefsFromLines(lines) {
      const refs: BusinessRef[] = [];
      for (const { file, line, text } of lines) {
        COMMENT_REF_PATTERN.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = COMMENT_REF_PATTERN.exec(text)) !== null) {
          refs.push({ ticketId: match[1], source: "comment", file, line });
        }
      }
      return refs;
    },

    extractRefsFromCommits(messages) {
      const refs: BusinessRef[] = [];
      for (const { message, files } of messages) {
        TICKET_PATTERN.lastIndex = 0;
        const tickets = new Set<string>();
        let match: RegExpExecArray | null;
        while ((match = TICKET_PATTERN.exec(message)) !== null) {
          tickets.add(match[0]);
        }
        for (const ticketId of tickets) {
          for (const file of files) {
            refs.push({ ticketId, source: "commit", file });
          }
        }
      }
      return refs;
    },

    async buildRTM(refs, registry) {
      const map = new Map<
        string,
        { symbols: Set<string>; tests: Set<string>; docs: Set<string> }
      >();

      for (const ref of refs) {
        if (!map.has(ref.ticketId)) {
          map.set(ref.ticketId, { symbols: new Set(), tests: new Set(), docs: new Set() });
        }
        const entry = map.get(ref.ticketId)!;

        if (ref.symbolId) {
          entry.symbols.add(ref.symbolId);
        }

        if (/\.(test|spec)\./i.test(ref.file)) {
          entry.tests.add(ref.file);
        } else {
          entry.symbols.add(ref.file);
        }
      }

      // Enrich with doc mappings
      for (const [, entry] of map) {
        for (const sym of entry.symbols) {
          const docs = await registry.findDocBySymbol(sym);
          for (const doc of docs) {
            entry.docs.add(doc.docPath);
          }
        }
      }

      return [...map.entries()].map(([ticketId, entry]) => ({
        ticketId,
        symbols: [...entry.symbols],
        tests: [...entry.tests],
        docs: [...entry.docs],
      }));
    },
  };
}

function parseGitLog(stdout: string): Array<{ message: string; files: string[] }> {
  const results: Array<{ message: string; files: string[] }> = [];
  const blocks = stdout.split("\n\n");

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length === 0 || !lines[0]) continue;

    const headerParts = lines[0].split("|||");
    const message = headerParts[0] ?? "";
    const files = lines.slice(1).filter((l) => l.trim().length > 0);

    if (message) {
      results.push({ message, files });
    }
  }

  return results;
}
