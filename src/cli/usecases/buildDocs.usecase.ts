import "reflect-metadata";
import fs from "node:fs";
import path from "node:path";
import { setupContainer, resolve } from "../../di/container.js";
import { DATABASE_TOKEN } from "../../di/tokens.js";
import type Database from "better-sqlite3";
import { generateDocs } from "../../site/mdGenerator.js";
import { header, step, done, summary } from "../utils/index.js";

/**
 * Build docs command - Generate structured Markdown documentation
 */
export interface BuildDocsUseCaseParams {
  outDir?: string;
  dbPath?: string;
  rootDir?: string;
}

export async function buildDocsUseCase(params: BuildDocsUseCaseParams): Promise<void> {
  const {
    outDir = "docs-output",
    dbPath = ".docs-kit/index.db",
    rootDir = ".",
  } = params;

  if (!fs.existsSync(dbPath)) {
    console.error(`Error: Database not found at ${dbPath}`);
    console.error(`Run "docs-kit index" first to create the index.`);
    process.exit(1);
  }

  await setupContainer({ dbPath });

  header(`Generating docs: ${outDir}/`);

  step("Reading index from SQLite");
  done(dbPath);

  step("Generating Markdown pages");
  const db = resolve<Database.Database>(DATABASE_TOKEN);
  const result = generateDocs({ db, outDir, rootDir });
  done();

  db.close();

  header("Docs Summary");
  summary([
    ["Symbol pages", result.symbolPages],
    ["File pages", result.filePages],
    ["Total files", result.totalFiles],
    ["Output", path.resolve(outDir)],
  ]);

  console.log(`\n  Open ${outDir}/README.md to browse the documentation.\n`);
}
