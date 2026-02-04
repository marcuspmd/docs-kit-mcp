#!/usr/bin/env node
import { createContainer } from "../config/container.js";
import { CliAdapter } from "../adapters/cli/CliAdapter.js";

async function main() {
  // LLM configuration (optional)
  const llmConfig = process.env.OPENAI_API_KEY
    ? {
        provider: "openai" as const,
        model: process.env.LLM_MODEL || "gpt-4o-mini",
        apiKey: process.env.OPENAI_API_KEY,
      }
    : undefined;

  const container = createContainer({
    database: { type: "sqlite", path: ".docs-kit/index.db" },
    llm: llmConfig,
  });

  const cli = new CliAdapter({
    indexProject: container.indexProject,
    findSymbol: container.findSymbol,
    explainSymbol: container.explainSymbol,
    buildDocs: container.buildDocs,
    buildSite: container.buildSite,
    analyzeImpact: container.analyzeImpact,
  });

  await cli.run(process.argv.slice(2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
