import "reflect-metadata";
import fs from "node:fs";
import path from "node:path";
import { setupContainer, resolve } from "../../di/container.js";
import { DATABASE_TOKEN } from "../../di/tokens.js";
import type Database from "better-sqlite3";
import { generateSite } from "../../site/generator.js";
import { header, step, done, summary } from "../utils/index.js";

/**
 * Build site command - Generate static HTML documentation site
 */
export interface BuildSiteUseCaseParams {
  outDir?: string;
  dbPath?: string;
  rootDir?: string;
}

export async function buildSiteUseCase(params: BuildSiteUseCaseParams): Promise<void> {
  const { outDir = "docs-site", dbPath = ".docs-kit/index.db", rootDir = "." } = params;

  if (!fs.existsSync(dbPath)) {
    console.error(`Error: Database not found at ${dbPath}`);
    console.error(`Run "docs-kit index" first to create the index.`);
    process.exit(1);
    return;
  }

  await setupContainer({ dbPath });

  header(`Generating site: ${outDir}/`);

  step("Reading index from SQLite");
  done(dbPath);

  step("Generating HTML pages");
  const db = resolve<Database.Database>(DATABASE_TOKEN);
  const result = generateSite({ db, outDir, rootDir });
  done();

  db.close();

  header("Site Summary");
  summary([
    ["Symbol pages", result.symbolPages],
    ["File pages", result.filePages],
    ["Total files", result.totalFiles],
    ["Output", path.resolve(outDir)],
  ]);

  console.log(`\n  Open ${outDir}/index.html in your browser.\n`);
}
