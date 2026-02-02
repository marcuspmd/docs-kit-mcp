import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerDependencies } from "../types.js";
import { mcpSuccess, mcpError } from "../types.js";
import { analyzeChanges } from "../../analyzer/changeAnalyzer.js";
import { createDocUpdater } from "../../docs/docUpdater.js";

export const generateDocsSchema = {
  base: z.string().default("main").describe("Base ref (e.g. main)"),
  head: z.string().optional().describe("Head ref"),
  dryRun: z.boolean().default(false).describe("Preview without writing"),
  docsDir: z.string().default("docs").describe("Docs directory"),
};

export function registerGenerateDocsTool(server: McpServer, deps: ServerDependencies): void {
  const { config, registry } = deps;

  server.registerTool(
    "generateDocs",
    {
      description: "Update docs for symbols affected by recent changes",
      inputSchema: generateDocsSchema,
    },
    async ({ base, head, dryRun, docsDir }) => {
      try {
        await registry.rebuild(docsDir);
        const impacts = await analyzeChanges({
          repoPath: config.projectRoot,
          base,
          head,
        });
        const updater = createDocUpdater({ dryRun });
        const results = await updater.applyChanges(impacts, registry, docsDir, config);

        const summary = results
          .filter((r) => r.action !== "skipped")
          .map((r) => `${r.action}: ${r.symbolName} in ${r.docPath}`)
          .join("\n");

        return mcpSuccess(summary || "No doc updates needed.");
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );
}
