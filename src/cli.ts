#!/usr/bin/env node

/**
 * CLI entry point - Refactored to use use cases
 */
import "reflect-metadata";

import { parseArgs, printHelp } from "./cli/utils/index.js";
import {
  initUseCase,
  indexUseCase,
  buildSiteUseCase,
  buildDocsUseCase,
  impactAnalysisUseCase,
  analyzePatternsUseCase,
} from "./cli/usecases/index.js";

/* ================== Command Handlers ================== */

async function runInit(args: string[]) {
  const rootDir = args[0] || ".";
  await initUseCase({ rootDir });
}

async function runIndex(args: string[]) {
  const { positional, flags } = parseArgs(args, {
    db: "",
    docs: "",
    full: undefined as unknown as string,
  });

  await indexUseCase({
    rootDir: positional[0],
    dbPath: flags.db,
    docsDir: flags.docs,
    fullRebuild: "full" in flags,
  });
}

async function runBuildSite(args: string[]) {
  const { flags } = parseArgs(args, {
    out: "docs-site",
    db: ".docs-kit/index.db",
    root: ".",
  });

  await buildSiteUseCase({
    outDir: flags.out,
    dbPath: flags.db,
    rootDir: flags.root,
  });
}

async function runBuildDocs(args: string[]) {
  const { flags } = parseArgs(args, {
    out: "docs-output",
    db: ".docs-kit/index.db",
    root: ".",
  });

  await buildDocsUseCase({
    outDir: flags.out,
    dbPath: flags.db,
    rootDir: flags.root,
  });
}

async function runImpactAnalysis(args: string[]) {
  const { positional, flags } = parseArgs(args, {
    "max-depth": "3",
    db: "",
    docs: "docs",
  });

  const symbolName = positional[0];
  if (!symbolName) {
    console.error("Usage: docs-kit impact-analysis <symbol> [--max-depth n] [--db path]");
    process.exit(1);
  }

  const result = await impactAnalysisUseCase({
    symbolName,
    maxDepth: parseInt(flags["max-depth"] || "3", 10) || 3,
    dbPath: flags.db,
    docsDir: flags.docs,
  });

  console.log(result);
}

async function runAnalyzePatterns(args: string[]) {
  const { flags } = parseArgs(args, { db: "" });

  const result = await analyzePatternsUseCase({
    dbPath: flags.db,
  });

  const report = result.patterns
    .map((p) => {
      const symbolNames = p.symbols.join(", ");
      const violations = p.violations.map((v) => `- ${v}`).join("\n");
      return `**${p.kind.toUpperCase()}** (confidence: ${(p.confidence * 100).toFixed(0)}%)\nSymbols: ${symbolNames}\nViolations:\n${violations || "None"}`;
    })
    .join("\n\n");

  console.log(report || "No patterns detected.");
}

/* ================== Main ================== */

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case "init":
        await runInit(args.slice(1));
        break;
      case "index":
        await runIndex(args.slice(1));
        break;
      case "build-site":
        await runBuildSite(args.slice(1));
        break;
      case "build-docs":
        await runBuildDocs(args.slice(1));
        break;
      case "impact-analysis":
        await runImpactAnalysis(args.slice(1));
        break;
      case "analyze-patterns":
        await runAnalyzePatterns(args.slice(1));
        break;
      default:
        printHelp();
        process.exit(command === "--help" || command === "-h" ? 0 : 1);
    }
  } catch (err) {
    console.error("Error:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
