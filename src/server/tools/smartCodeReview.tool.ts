import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerDependencies } from "../types.js";
import { mcpSuccess, mcpError } from "../types.js";
import { performSmartCodeReview } from "../../governance/smartCodeReview.js";

export const smartCodeReviewSchema = {
  docsDir: z.string().default("docs").describe("Docs directory"),
  includeExamples: z.boolean().default(true).describe("Include code example validation"),
};

export function registerSmartCodeReviewTool(server: McpServer, deps: ServerDependencies): void {
  const {
    symbolRepo,
    relRepo,
    registry,
    patternAnalyzer,
    archGuard,
    reaper,
    graph,
    codeExampleValidator,
  } = deps;

  server.registerTool(
    "smartCodeReview",
    {
      description:
        "Perform comprehensive code review combining architecture analysis, pattern detection, dead code scanning, and documentation validation",
      inputSchema: smartCodeReviewSchema,
    },
    async ({ docsDir, includeExamples }) => {
      try {
        const result = await performSmartCodeReview(
          { docsDir, includeExamples },
          {
            symbolRepo,
            relRepo,
            registry,
            patternAnalyzer,
            archGuard,
            reaper,
            graph,
            codeExampleValidator,
          },
        );

        return mcpSuccess(result);
      } catch (err) {
        return mcpError(`Error performing smart code review: ${(err as Error).message}`);
      }
    },
  );
}
