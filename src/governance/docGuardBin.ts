#!/usr/bin/env node

import { parseArgs } from "node:util";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import Database from "better-sqlite3";
import { dirname } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { runDocGuard, formatResult } from "./docGuardCli.js";
import { analyzeChanges } from "../analyzer/changeAnalyzer.js";
import { createDocRegistry } from "../docs/docRegistry.js";

const execFileAsync = promisify(execFile);

const { values } = parseArgs({
  options: {
    base: { type: "string", default: "main" },
    head: { type: "string" },
    strict: { type: "boolean", default: true },
    "db-path": { type: "string", default: ".doc-kit/registry.db" },
    "docs-dir": { type: "string", default: "docs" },
  },
});

async function getChangedFiles(options: {
  repoPath: string;
  base: string;
  head?: string;
}): Promise<string[]> {
  const head = options.head ?? "HEAD";
  const { stdout } = await execFileAsync(
    "git",
    ["diff", "--name-only", `${options.base}...${head}`],
    { cwd: options.repoPath },
  );
  return stdout.trim().split("\n").filter(Boolean);
}

// Garante que o diretório do banco existe
const dbPath = values["db-path"]!;
const dbDir = dirname(dbPath);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}
const db = new Database(dbPath);
const registry = createDocRegistry(db);
await registry.rebuild(values["docs-dir"]!);

const result = await runDocGuard(
  {
    repoPath: process.cwd(),
    base: values.base!,
    head: values.head,
    strict: values.strict,
  },
  {
    analyzeChanges,
    registry,
    getChangedFiles,
  },
);

db.close();

console.log(formatResult(result));

if (!result.passed) {
  process.exit(1);
}
