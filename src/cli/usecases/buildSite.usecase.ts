import "reflect-metadata";
import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "../../configLoader.js";
import { setupContainer, resolve } from "../../di/container.js";
import { DATABASE_TOKEN } from "../../di/tokens.js";
import type Database from "better-sqlite3";
import { generateSite } from "../../site/generator.js";
import { generateSiteV2 } from "../../site/v2Generator.js";
import { header, step, done, summary } from "../utils/index.js";
import { resolveConfigPath } from "../utils/index.js";

/**
 * Build site command - Generate static HTML documentation site
 */
export interface BuildSiteUseCaseParams {
  outDir?: string;
  dbPath?: string;
  rootDir?: string;
  version?: string;
}

export async function buildSiteUseCase(params: BuildSiteUseCaseParams): Promise<void> {
  const configDir = process.cwd();
  const config = await loadConfig(configDir);

  const outDir = params.outDir ?? config.output.site;
  const dbPath = resolveConfigPath(params.dbPath, configDir, config.dbPath);
  const rootDir = params.rootDir ?? config.rootDir;
  const version = params.version === "v2" ? "v2" : "v1";

  if (!fs.existsSync(dbPath)) {
    console.error(`Error: Database not found at ${dbPath}`);
    console.error(`Run "docs-kit index" first to create the index.`);
    process.exit(1);
    return;
  }

  await setupContainer({ dbPath });

  header(`Generating site: ${outDir}/ (${version})`);

  step("Reading index from SQLite");
  done(dbPath);

  step(version === "v2" ? "Generating React v2 site" : "Generating HTML pages");
  const db = resolve<Database.Database>(DATABASE_TOKEN);
  try {
    const result =
      version === "v2"
        ? await generateSiteV2({ db, outDir, rootDir })
        : generateSite({ db, outDir, rootDir });
    done();

    header("Site Summary");
    const rows: Array<[string, string | number]> = [
      ["Version", version],
      ["Symbol pages", result.symbolPages],
      ["File pages", result.filePages],
      ["Total files", result.totalFiles],
      ["Output", path.resolve(outDir)],
    ];
    if (version === "v2") {
      const v2Result = result as Awaited<ReturnType<typeof generateSiteV2>>;
      rows.splice(3, 0, ["Classes", v2Result.classCount]);
      rows.splice(4, 0, ["Modules", v2Result.moduleCount]);
    }
    summary(rows);
  } finally {
    db.close();
  }

  console.log(`\n  Open ${outDir}/index.html in your browser.\n`);
}
