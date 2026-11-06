import "reflect-metadata";
import path from "node:path";
import { loadConfig } from "../../configLoader.js";
import { setupContainer, resolve } from "../../di/container.js";
import { DATABASE_TOKEN } from "../../di/tokens.js";
import type Database from "better-sqlite3";
import { generateSiteV2 } from "../../site/v2Generator.js";
import { header, step, done, summary, assertDatabaseExists } from "../utils/index.js";
import { resolveConfigPath } from "../utils/index.js";

/**
 * Build site command - Generate the React v2 documentation site.
 */
export interface BuildSiteUseCaseParams {
  outDir?: string;
  dbPath?: string;
  rootDir?: string;
}

export async function buildSiteUseCase(params: BuildSiteUseCaseParams): Promise<void> {
  const configDir = process.cwd();
  const config = await loadConfig(configDir);

  const outDir = params.outDir ?? config.output.site;
  const dbPath = resolveConfigPath(params.dbPath, configDir, config.dbPath);
  const rootDir = params.rootDir ?? config.rootDir;

  assertDatabaseExists(dbPath);

  await setupContainer({ dbPath });

  header(`Generating site: ${outDir}/`);

  step("Reading index from SQLite");
  done(dbPath);

  step("Generating React v2 site");
  const db = resolve<Database.Database>(DATABASE_TOKEN);
  try {
    const result = await generateSiteV2({
      db,
      outDir,
      rootDir,
      lcovPath: config.coverage?.enabled ? path.resolve(configDir, config.coverage.lcovPath) : undefined,
      coverageIgnore: config.coverage?.ignore ?? [],
    });
    done();

    header("Site Summary");
    summary([
      ["Symbol pages", result.symbolPages],
      ["File pages", result.filePages],
      ["Classes", result.classCount],
      ["Modules", result.moduleCount],
      ["Total files", result.totalFiles],
      ["Output", path.resolve(outDir)],
    ]);
  } finally {
    db.close();
  }

  console.log(`\n  Open ${outDir}/index.html in your browser.\n`);
}
