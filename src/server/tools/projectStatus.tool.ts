import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerDependencies } from "../types.js";
import { mcpSuccess, mcpError } from "../types.js";
import { generateProjectStatus, formatProjectStatus } from "../../governance/projectStatus.js";

export const projectStatusSchema = {
  docsDir: z.string().default("docs").describe("Docs directory"),
};

export function registerProjectStatusTool(
  server: McpServer,
  deps: ServerDependencies,
): void {
  const { symbolRepo, relRepo, registry, patternAnalyzer, archGuard, reaper, graph } = deps;

  server.registerTool(
    "projectStatus",
    {
      description:
        "Generate comprehensive project status report with documentation coverage, patterns, and metrics",
      inputSchema: projectStatusSchema,
    },
    async ({ docsDir }) => {
      try {
        const result = await generateProjectStatus(
          { docsDir },
          {
            symbolRepo,
            relRepo,
            registry,
            patternAnalyzer,
            archGuard,
            reaper,
            graph,
          },
        );

        return mcpSuccess(formatProjectStatus(result));
      } catch (err) {
        return mcpError(`Error generating status report: ${(err as Error).message}`);
      }
    },
  );
}
