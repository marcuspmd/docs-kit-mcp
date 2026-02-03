#!/usr/bin/env node
import { createContainer } from "../config/container.js";
import { McpAdapter } from "../adapters/mcp/McpAdapter.js";

async function main() {
  const container = createContainer({ database: { type: "sqlite", path: ".docs-kit/index.db" } });

  const mcp = new McpAdapter({
    indexProject: container.indexProject,
    explainSymbol: container.explainSymbol,
    buildSite: container.buildSite,
  });

  await mcp.start();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
