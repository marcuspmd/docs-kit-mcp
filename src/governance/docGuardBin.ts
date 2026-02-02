#!/usr/bin/env node

import "reflect-metadata";
import { parseArgs } from "node:util";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { setupContainer, resolve } from "../di/container.js";
import { DATABASE_TOKEN, DOC_REGISTRY_TOKEN } from "../di/tokens.js";
import type Database from "better-sqlite3";
import type { DocRegistry } from "../docs/docRegistry.js";
import { runDocGuard, formatResult } from "./docGuardCli.js";
import { analyzeChanges } from "../analyzer/changeAnalyzer.js";

const execFileAsync = promisify(execFile);

const { values } = parseArgs({
  options: {
    base: { type: "string", default: "main" },
    head: { type: "string" },
    strict: { type: "boolean", default: true },
    "db-path": { type: "string", default: ".docs-kit/registry.db" },
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

await setupContainer({ dbPath: values["db-path"]! });

const db = resolve<Database.Database>(DATABASE_TOKEN);
const registry = resolve<DocRegistry>(DOC_REGISTRY_TOKEN);
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
