import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerDependencies } from "../types.js";
import { mcpSuccess, mcpError } from "../types.js";
import { buildImpactAnalysisPrompt } from "../../prompts/impactAnalysis.prompt.js";

export const impactAnalysisSchema = {
  symbol: z.string().describe("Symbol name (e.g. OrderService.createOrder)"),
  maxDepth: z.number().default(3).describe("Maximum depth to traverse dependencies"),
};

export function registerImpactAnalysisTool(server: McpServer, deps: ServerDependencies): void {
  const { symbolRepo, graph } = deps;

  server.registerTool(
    "impactAnalysis",
    {
      description: "Analyze what breaks if a symbol changes, using the Knowledge Graph",
      inputSchema: impactAnalysisSchema,
    },
    async ({ symbol, maxDepth }) => {
      try {
        const symbols = symbolRepo.findByName(symbol);
        if (symbols.length === 0) {
          return mcpSuccess(`No symbol found with name: ${symbol}`);
        }

        const targetSymbol = symbols[0];
        const impactedIds = graph.getImpactRadius(targetSymbol.id, maxDepth);
        const impactedSymbols = symbolRepo.findByIds(impactedIds);

        const prompt = buildImpactAnalysisPrompt({
          targetSymbol,
          impactedSymbols,
          maxDepth,
        });

        return mcpSuccess(prompt);
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );
}
