#!/usr/bin/env node
import { createContainer } from "../config/container.js";
import { CliAdapter } from "../adapters/cli/CliAdapter.js";

async function main() {
  const container = createContainer({ database: { type: "sqlite", path: ".docs-kit/index.db" } });

  const cli = new CliAdapter({
    indexProject: container.indexProject,
    findSymbol: container.findSymbol,
    explainSymbol: container.explainSymbol,
    buildDocs: container.buildDocs,
    buildSite: container.buildSite,
  });

  await cli.run(process.argv.slice(2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
