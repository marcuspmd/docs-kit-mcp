import "reflect-metadata";
import path from "node:path";
import type Database from "better-sqlite3";
import { analyzeChanges } from "../../analyzer/changeAnalyzer.js";
import { getGitChangedFiles } from "../../analyzer/gitDiff.js";
import { loadConfig } from "../../configLoader.js";
import type { DocRegistry } from "../../docs/docRegistry.js";
import { createDocUpdater } from "../../docs/docUpdater.js";
import { setupContainer, resolve } from "../../di/container.js";
import { DATABASE_TOKEN, DOC_REGISTRY_TOKEN, LLM_PROVIDER_TOKEN } from "../../di/tokens.js";
import { evaluateDocGuard, formatResult } from "../../governance/docGuardCli.js";
import { buildDiffReview } from "../../governance/diffReview.js";
import type { DocGuardResult } from "../../governance/docGuardCli.js";
import type { DiffReviewSummary } from "../../governance/diffReview.js";
import type { ChangeImpact } from "../../indexer/symbol.types.js";
import type { LlmProvider } from "../../llm/provider.js";
import { buildDiffSiteMetadata, filterSiteDataForDiff } from "../../site/diffData.js";
import { loadSiteData } from "../../site/dataLoader.js";
import { generateSiteV2 } from "../../site/v2Generator.js";
import { done, header, step, summary, assertDatabaseExists } from "../utils/index.js";
import { resolveConfigPath } from "../utils/index.js";

export interface DiffUseCaseParams {
  base: string;
  head?: string;
  outDir?: string;
  dbPath?: string;
  docsDir?: string;
  rootDir?: string;
  strict?: boolean;
  aiReview?: boolean;
}

export interface DiffUseCaseResult {
  changedFiles: string[];
  impacts: ChangeImpact[];
  docGuard: DocGuardResult;
  review: DiffReviewSummary;
  outDir: string;
}

export async function diffUseCase(params: DiffUseCaseParams): Promise<DiffUseCaseResult> {
  const configDir = process.cwd();
  const config = await loadConfig(configDir);
  const base = params.base;
  const head = params.head || undefined;
  const outDir = params.outDir ?? "docs-site-diff";
  const dbPath = resolveConfigPath(params.dbPath, configDir, config.dbPath);
  const docsDir = params.docsDir ?? "docs";
  const rootDir = params.rootDir ? path.resolve(configDir, params.rootDir) : config.projectRoot;
  const range = "merge-base" as const;

  assertDatabaseExists(dbPath);

  await setupContainer({ dbPath });

  header(`Generating diff preview: ${base}...${head ?? "HEAD"}`);

  step("Reading index from SQLite");
  const db = resolve<Database.Database>(DATABASE_TOKEN);
  const registry = resolve<DocRegistry>(DOC_REGISTRY_TOKEN);
  done(dbPath);

  let strictFailure = false;
  let _changedFiles: string[] = [];
  let _impacts: ChangeImpact[] = [];
  let _docGuard: DocGuardResult | undefined;
  let _review: DiffReviewSummary | undefined;

  try {
    step("Rebuilding doc registry");
    await registry.rebuild(docsDir);
    done(docsDir);

    step("Collecting changed files");
    const changedFiles = await getGitChangedFiles({
      repoPath: config.projectRoot,
      base,
      head,
      range,
    });
    done(`${changedFiles.length} file(s)`);
    _changedFiles = changedFiles;

    step("Analyzing semantic changes");
    const impacts = await analyzeChanges({
      repoPath: config.projectRoot,
      base,
      head,
      range,
    });
    done(`${impacts.length} impact(s)`);
    _impacts = impacts;

    step("Generating documentation preview");
    const updater = createDocUpdater({ dryRun: true });
    const docUpdates = await updater.applyChanges(impacts, registry, docsDir, config);
    done(`${docUpdates.filter((update) => update.action !== "skipped").length} update(s)`);

    step("Evaluating Docs-Guard");
    const docGuard = await evaluateDocGuard({
      impacts,
      changedFiles,
      registry,
      strict: true,
    });
    done(docGuard.passed ? "passed" : `${docGuard.uncoveredChanges.length} violation(s)`);
    _docGuard = docGuard;

    step("Building diff-scoped site data");
    const fullData = loadSiteData(db, rootDir);
    const filteredData = filterSiteDataForDiff(fullData, {
      impacts,
      changedFiles,
      docUpdates,
    });
    const llmProviderName = config.llm.provider ?? "none";
    const llm =
      params.aiReview && llmProviderName !== "none"
        ? resolve<LlmProvider>(LLM_PROVIDER_TOKEN)
        : undefined;
    done(`${filteredData.symbols.length} symbol(s)`);

    step("Building diff review summary");
    const review = await buildDiffReview({
      impacts,
      data: filteredData,
      docGuard,
      aiReview: Boolean(params.aiReview),
      llm,
      provider: llmProviderName,
    });
    done(review.status);
    _review = review;

    const diff = buildDiffSiteMetadata({
      base,
      head,
      range,
      changedFiles,
      impacts,
      docUpdates,
      docGuard,
      review,
    });

    step("Generating React v2 diff site");
    const result = await generateSiteV2({
      db,
      data: filteredData,
      diff,
      outDir,
      rootDir,
    });
    done();

    header("Diff Preview Summary");
    summary([
      ["Range", `${base}...${head ?? "HEAD"}`],
      ["Changed files", changedFiles.length],
      ["Impacted symbols", impacts.length],
      ["Doc updates", docUpdates.filter((update) => update.action !== "skipped").length],
      ["Docs-Guard", docGuard.passed ? "passed" : "failed"],
      ["Violations", docGuard.uncoveredChanges.length],
      ["AI Review", review.status],
      ["Output", path.resolve(outDir)],
      ["Data", result.dataFile],
    ]);

    console.log(`\n${formatResult(docGuard)}`);
    console.log(`\n  Open ${outDir}/index.html in your browser.\n`);

    strictFailure = Boolean(params.strict && !docGuard.passed);
  } finally {
    db.close();
  }

  if (strictFailure) {
    process.exit(1);
  }

  return {
    changedFiles: _changedFiles,
    impacts: _impacts,
    docGuard: _docGuard ?? { passed: true, totalChanges: 0, coveredChanges: 0, uncoveredChanges: [] },
    review: _review ?? { status: "not_requested", items: [], totalFindings: 0, findingsBySeverity: {} },
    outDir,
  };
}
